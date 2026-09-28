# -*- coding: utf-8 -*-
"""Call recordings for the desk: list them, transcribe them locally, file the
transcript on the lead.

Recordings are Twilio dual-channel (lib/twilio-recording.ts): the customer and
the owner are on separate tracks, so each track is transcribed on its own and
the turns are merged by time with the speaker known - no diarization guesswork.
Transcription runs on this machine with faster-whisper (no audio leaves the
desk); the models are cached under ~/.cache/huggingface. Twilio credentials
come from .env.local and are never printed.
"""
from __future__ import annotations

import base64
import json
import pathlib
import re
import subprocess
import sys
import urllib.request

from _api import ROOT, dump, env, is_uuid, pt, site_get, site_post, e164

CACHE = ROOT / "scripts" / "desk" / "cache"  # gitignored: transcripts are customer conversations
TWILIO = "https://api.twilio.com/2010-04-01/Accounts"


def _twilio_get(path: str, *, raw: bool = False):
    sid, tok = env("TWILIO_ACCOUNT_SID"), env("TWILIO_AUTH_TOKEN")
    auth = base64.b64encode(f"{sid}:{tok}".encode()).decode()
    req = urllib.request.Request(f"{TWILIO}/{sid}{path}", headers={"Authorization": "Basic " + auth, "user-agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    return data if raw else json.loads(data.decode("utf-8"))


def lead_for(ident: str) -> dict | None:
    """The lead row behind a phone or lead id (via the desk card, one call)."""
    params = {"lead": ident} if is_uuid(ident) else {"phone": e164(ident)}
    cards = site_get("/api/admin/desk", params).get("cards") or []
    return (cards[0].get("lead") if cards else None) or None


def recordings_for(ident: str) -> list[dict]:
    """Recordings on the lead's timeline (call_recording touchpoints), newest
    first; falls back to Twilio's call list for a number with no lead."""
    lead = lead_for(ident)
    out: list[dict] = []
    if lead:
        events = site_get("/api/admin/leads", {"detail": lead["id"]}).get("events") or []
        for ev in events:
            if ev.get("touchpoint_type") != "call_recording":
                continue
            p = ev.get("raw_payload_json") or {}
            if p.get("recording_sid"):
                out.append({"at": ev.get("occurred_at"), "recording_sid": p["recording_sid"], "call_sid": p.get("call_sid"),
                            "duration": int(p.get("duration_seconds") or 0), "lead_id": lead["id"], "phone": lead.get("phone")})
    if not out and not is_uuid(ident):
        phone = e164(ident)
        for direction in ("From", "To"):
            for c in _twilio_get(f"/Calls.json?{direction}={urllib.request.quote(phone)}&PageSize=20").get("calls", []):
                for r in _twilio_get(f"/Calls/{c['sid']}/Recordings.json").get("recordings", []):
                    out.append({"at": r.get("date_created"), "recording_sid": r["sid"], "call_sid": c["sid"],
                                "duration": int(r.get("duration") or 0), "lead_id": None, "phone": phone})
    out.sort(key=lambda r: r.get("at") or "", reverse=True)
    return out


def download(recording_sid: str) -> pathlib.Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / f"{recording_sid}.mp3"
    if not p.exists():
        p.write_bytes(_twilio_get(f"/Recordings/{recording_sid}.mp3", raw=True))
    return p


def split_channels(mp3: pathlib.Path) -> list[tuple[str, pathlib.Path]]:
    """[(label, wav)] - two tracks for a dual-channel recording, one for mono.
    Twilio puts the caller on the first channel; on our inbound line that is
    the customer and the second channel is us."""
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=channels", "-of", "csv=p=0", str(mp3)],
                           capture_output=True, text=True)
    channels = int((probe.stdout or "1").strip().splitlines()[0] or 1)
    if channels < 2:
        wav = mp3.with_suffix(".mono.wav")
        if not wav.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-ac", "1", "-ar", "16000", str(wav)], check=True)
        return [("?", wav)]
    left, right = mp3.with_suffix(".c1.wav"), mp3.with_suffix(".c2.wav")
    if not (left.exists() and right.exists()):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-filter_complex",
                        "[0:a]channelsplit=channel_layout=stereo[l][r]",
                        "-map", "[l]", "-ar", "16000", str(left), "-map", "[r]", "-ar", "16000", str(right)], check=True)
    return [("客", left), ("我", right)]


def transcribe(recording_sid: str, model_name: str = "small", swap: bool = False) -> list[dict]:
    """[{start, end, who, text}] merged by time. Cached per recording+model."""
    cached = CACHE / f"{recording_sid}.{model_name}.json"
    if cached.exists():
        segs = json.loads(cached.read_text(encoding="utf-8"))
    else:
        from faster_whisper import WhisperModel  # local import: slow, only when needed

        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        segs = []
        for who, wav in split_channels(download(recording_sid)):
            result, _info = model.transcribe(str(wav), language="en", beam_size=5, vad_filter=True,
                                             vad_parameters={"min_silence_duration_ms": 500})
            for s in result:
                text = s.text.strip()
                if text:
                    segs.append({"start": round(s.start, 1), "end": round(s.end, 1), "who": who, "text": text})
        segs.sort(key=lambda s: s["start"])
        cached.write_text(json.dumps(segs, ensure_ascii=False, indent=0), encoding="utf-8")
    if swap:
        flip = {"客": "我", "我": "客"}
        segs = [{**s, "who": flip.get(s["who"], s["who"])} for s in segs]
    return segs


def render(segs: list[dict]) -> str:
    """Consecutive segments by the same speaker fold into one line."""
    lines: list[str] = []
    cur_who, cur_start, cur_text = None, 0.0, []
    for s in segs:
        if s["who"] != cur_who and cur_text:
            lines.append(f"[{cur_start:5.0f}s] {cur_who}: {' '.join(cur_text)}")
            cur_text = []
        if not cur_text:
            cur_who, cur_start = s["who"], s["start"]
        cur_text.append(s["text"])
    if cur_text:
        lines.append(f"[{cur_start:5.0f}s] {cur_who}: {' '.join(cur_text)}")
    return "\n".join(lines)


def file_on_lead(lead_id: str, rec: dict, text: str) -> int:
    """Write the transcript to the lead timeline as [call] notes; the note
    endpoint keeps 2000 characters, so long calls become several parts."""
    head = f"[call] {pt(rec.get('at'))} PT · {rec.get('duration', 0)}s · {rec.get('recording_sid')}"
    body = text
    limit = 1900 - len(head)
    parts = [body[i:i + limit] for i in range(0, len(body), limit)] or [""]
    for i, part in enumerate(parts, 1):
        tag = f" ({i}/{len(parts)})" if len(parts) > 1 else ""
        site_post("/api/admin/leads", {"action": "add_note", "leadId": lead_id, "note": f"{head}{tag}\n{part}"}, method="PATCH")
    return len(parts)


# ---------------------------------------------------------------- commands --
def cmd_calls(a):
    recs = recordings_for(a.ident)
    if not recs:
        print("没有录音（线索时间线和 Twilio 都没有）")
        return
    for r in recs:
        print(f"{pt(r['at'])}  {r['duration']:4d}s  {r['recording_sid']}  call {r.get('call_sid')}")


def cmd_transcribe(a):
    recs = recordings_for(a.ident)
    if a.sid:
        recs = [r for r in recs if r["recording_sid"] == a.sid] or [{"recording_sid": a.sid, "at": None, "duration": 0, "lead_id": None}]
    else:
        recs = list(reversed(recs[: a.last]))  # oldest of the chosen ones first
    if not recs:
        raise SystemExit("no recordings")
    for r in recs:
        segs = transcribe(r["recording_sid"], a.model, swap=a.swap)
        text = render(segs)
        print("━" * 78)
        print(f"通话 {pt(r.get('at'))} PT · {r.get('duration', 0)}s · {r['recording_sid']} · model {a.model}")
        print(text)
        if a.note:
            lead_id = r.get("lead_id") or (lead_for(a.ident) or {}).get("id")
            if not lead_id:
                print("   (no lead to file this on)")
                continue
            n = file_on_lead(lead_id, r, text)
            print(f"   filed on lead {lead_id} in {n} note(s)")
        if a.json:
            print(dump(segs))
