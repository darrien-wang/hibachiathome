"""Build the WebP ladder in public/_opt that lib/image-loader.ts serves.

For every jpg/jpeg/png in public/gallery, public/images/hero and public/images/menu, write
public/_opt/<dir>/<name>-<width>.webp for each width in LADDER (never upscaled past the original).
Only missing files are written unless --force, so existing rungs stay byte-identical.
Recipe matches the rungs already in the repo: Pillow, WebP quality 80, method 4.

usage:  python scripts/gen-opt-images.py            # write what is missing, then verify
        python scripts/gen-opt-images.py --check    # verify only; exit 1 if any rung is missing
Keep LADDER in sync with lib/image-loader.ts (tests/image-loader.test.ts checks the files exist).
"""
import os, re, sys
from PIL import Image, ImageOps

LADDER = [160, 320, 480, 640, 960, 1280, 1920]
DIRS = ["gallery", "images/hero", "images/menu"]
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")
CHECK = "--check" in sys.argv
FORCE = "--force" in sys.argv

written = missing = total = 0
for d in DIRS:
    src_dir = os.path.join(ROOT, *d.split("/")); out_dir = os.path.join(ROOT, "_opt", *d.split("/"))
    os.makedirs(out_dir, exist_ok=True)
    for name in sorted(os.listdir(src_dir)):
        m = re.match(r"^(.+)\.(?:jpe?g|png)$", name, re.I)
        if not m: continue
        img = None
        for w in LADDER:
            total += 1
            out = os.path.join(out_dir, f"{m.group(1)}-{w}.webp")
            if os.path.exists(out) and not FORCE: continue
            if CHECK:
                missing += 1; print("missing:", os.path.relpath(out, ROOT)); continue
            if img is None:
                img = ImageOps.exif_transpose(Image.open(os.path.join(src_dir, name)))
                if img.mode not in ("RGB", "RGBA"): img = img.convert("RGBA" if "A" in img.getbands() or "transparency" in img.info else "RGB")
            tw = min(w, img.width); th = max(1, round(img.height * tw / img.width))
            (img if tw == img.width else img.resize((tw, th), Image.LANCZOS)).save(out, "WEBP", quality=80, method=4)
            written += 1
print(f"{total} rungs expected, {written} written, {missing} missing")
sys.exit(1 if missing else 0)
