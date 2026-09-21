import { type NextRequest, NextResponse } from "next/server"
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server"
import { createSession, memberActor, publicActor, requestMeta, resolveAdminActor, sessionCookie, type MemberRow } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { findActiveMember, normalizeLoginPhone } from "@/lib/workbench-login"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 记住设备 (通行密钥 / passkey, WebAuthn). One route, four actions:
//   register-options  (logged in)   -> options for navigator.credentials.create
//   register          (logged in)   -> stores the new credential for this member
//   login-options     (logged out)  -> options for navigator.credentials.get
//   login             (logged out)  -> verifies the assertion, sets the session cookie
// Challenges live in workbench_challenges for five minutes and are consumed
// on first use, so a captured response cannot be replayed.

const RP_NAME = "Real Hibachi 工作台"
const CHALLENGE_TTL_MS = 5 * 60_000

type Supabase = NonNullable<ReturnType<typeof createServerSupabaseClient>>
type PasskeyRow = { id: string; member_id: string; credential_id: string; public_key: string; counter: number; transports: string[] | null }

function relyingParty(request: NextRequest): { rpID: string; origin: string } {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "www.realhibachi.com").split(",")[0].trim()
  const hostname = host.replace(/:\d+$/, "")
  // The registrable suffix, so a passkey made on www also works on the apex.
  const rpID = hostname.endsWith("realhibachi.com") ? "realhibachi.com" : hostname
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || (hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https")
  return { rpID, origin: `${proto}://${host}` }
}

/** The challenge the browser signed, straight from clientDataJSON. */
function challengeOf(response: { response?: { clientDataJSON?: string } } | undefined): string | null {
  try {
    const raw = response?.response?.clientDataJSON
    if (!raw) return null
    const json = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { challenge?: unknown }
    return typeof json.challenge === "string" ? json.challenge : null
  } catch {
    return null
  }
}

async function rememberChallenge(supabase: Supabase, kind: "reg" | "auth", challenge: string, memberId: string | null) {
  await supabase.from("workbench_challenges").insert({ kind, member_id: memberId, challenge, expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString() })
}

/** Consumes the challenge; null when unknown, used already, or expired. */
async function takeChallenge(supabase: Supabase, kind: "reg" | "auth", challenge: string): Promise<{ memberId: string | null } | null> {
  const { data } = await supabase.from("workbench_challenges").select("id, member_id, expires_at").eq("challenge", challenge).eq("kind", kind).maybeSingle()
  if (!data) return null
  await supabase.from("workbench_challenges").delete().eq("id", data.id)
  if (Date.parse(data.expires_at) < Date.now()) return null
  return { memberId: data.member_id ?? null }
}

const transportsOf = (t: string[] | null | undefined) => (t && t.length ? (t as AuthenticatorTransportFuture[]) : undefined)

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  let body: Record<string, unknown> & { action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const { rpID, origin } = relyingParty(request)

  if (body.action === "register-options") {
    const actor = await resolveAdminActor(request)
    if (!actor?.memberId) return NextResponse.json({ ok: false, error: "先用手机号登录，再把设备记住" }, { status: 401 })
    const { data: existing } = await supabase.from("workbench_passkeys").select("credential_id, transports").eq("member_id", actor.memberId)
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: new Uint8Array(Buffer.from(actor.memberId, "utf8")),
      userName: actor.phone ?? actor.name ?? "member",
      userDisplayName: actor.name ?? "",
      attestationType: "none",
      excludeCredentials: ((existing ?? []) as Array<{ credential_id: string; transports: string[] | null }>).map((c) => ({ id: c.credential_id, transports: transportsOf(c.transports) })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    })
    await rememberChallenge(supabase, "reg", options.challenge, actor.memberId)
    return NextResponse.json({ ok: true, options })
  }

  if (body.action === "register") {
    const actor = await resolveAdminActor(request)
    if (!actor?.memberId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    const response = body.response as RegistrationResponseJSON | undefined
    const challenge = challengeOf(response)
    if (!response || !challenge) return NextResponse.json({ ok: false, error: "bad response" }, { status: 400 })
    const taken = await takeChallenge(supabase, "reg", challenge)
    if (!taken || taken.memberId !== actor.memberId) return NextResponse.json({ ok: false, error: "这次记住已过期，再点一次" }, { status: 400 })
    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>
    try {
      verification = await verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false })
    } catch (e) {
      return NextResponse.json({ ok: false, error: `验证失败：${e instanceof Error ? e.message : String(e)}` }, { status: 400 })
    }
    if (!verification.verified || !verification.registrationInfo) return NextResponse.json({ ok: false, error: "验证失败" }, { status: 400 })
    const { credential, credentialDeviceType } = verification.registrationInfo
    const deviceName = (typeof body.deviceName === "string" ? body.deviceName.trim().slice(0, 80) : "") || (credentialDeviceType === "multiDevice" ? "同步的通行密钥" : "这台设备")
    const { error } = await supabase.from("workbench_passkeys").insert({
      member_id: actor.memberId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? [],
      device_name: deviceName,
    })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, deviceName })
  }

  if (body.action === "login-options") {
    // With a phone we can hint the browser which credentials qualify; without
    // one the authenticator lists its discoverable passkeys for this site.
    const phone = normalizeLoginPhone(body.phone)
    let allow: Array<{ id: string; transports?: AuthenticatorTransportFuture[] }> = []
    if (phone) {
      const m = await findActiveMember(phone)
      if (m) {
        const { data } = await supabase.from("workbench_passkeys").select("credential_id, transports").eq("member_id", m.id)
        allow = ((data ?? []) as Array<{ credential_id: string; transports: string[] | null }>).map((c) => ({ id: c.credential_id, transports: transportsOf(c.transports) }))
        if (!allow.length) return NextResponse.json({ ok: false, error: "这个号码还没有记住任何设备，先用短信登录" }, { status: 404 })
      }
    }
    const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred", allowCredentials: allow.length ? allow : undefined })
    await rememberChallenge(supabase, "auth", options.challenge, null)
    return NextResponse.json({ ok: true, options })
  }

  if (body.action === "login") {
    const response = body.response as AuthenticationResponseJSON | undefined
    const challenge = challengeOf(response)
    if (!response?.id || !challenge) return NextResponse.json({ ok: false, error: "bad response" }, { status: 400 })
    const taken = await takeChallenge(supabase, "auth", challenge)
    if (!taken) return NextResponse.json({ ok: false, error: "登录请求已过期，再点一次" }, { status: 400 })
    const { data: pkRaw } = await supabase.from("workbench_passkeys").select("id, member_id, credential_id, public_key, counter, transports").eq("credential_id", response.id).maybeSingle()
    const pk = pkRaw as PasskeyRow | null
    if (!pk) return NextResponse.json({ ok: false, error: "这台设备的通行密钥已经不在了，用短信登录后重新记住" }, { status: 404 })
    const { data: mRaw } = await supabase.from("workbench_members").select("id, name, phone, role, perms, active").eq("id", pk.member_id).maybeSingle()
    const member = mRaw as MemberRow | null
    if (!member || !member.active) return NextResponse.json({ ok: false, error: "这个成员已停用" }, { status: 403 })
    let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: { id: pk.credential_id, publicKey: new Uint8Array(Buffer.from(pk.public_key, "base64url")), counter: Number(pk.counter), transports: transportsOf(pk.transports) },
        requireUserVerification: false,
      })
    } catch (e) {
      return NextResponse.json({ ok: false, error: `验证失败：${e instanceof Error ? e.message : String(e)}` }, { status: 401 })
    }
    if (!verification.verified) return NextResponse.json({ ok: false, error: "验证失败" }, { status: 401 })
    await supabase.from("workbench_passkeys").update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("id", pk.id)
    const session = await createSession(member.id, { via: "passkey", ...requestMeta(request) })
    if (!session) return NextResponse.json({ ok: false, error: "session not created" }, { status: 500 })
    const res = NextResponse.json({ ok: true, viewer: publicActor(memberActor(member)) })
    res.cookies.set(sessionCookie(session.token, session.expiresAt))
    return res
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 })
}
