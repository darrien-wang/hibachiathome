/**
 * next/image loader that serves the pre-built WebP ladder in public/_opt
 * instead of the multi-megabyte originals.
 *
 * Why not Vercel's optimizer: the site ran with `images.unoptimized: true`,
 * so every <Image> shipped the file as uploaded - 4-5 MB gallery JPEGs on
 * /quote and the ad landing pages. On simulated slow 4G that alone put
 * /quote at 27 s to interactive (Lighthouse, 2026-09-10). Turning the
 * hosted optimizer on would fix it but bills per source image on this
 * plan; a static ladder costs nothing at runtime and never 404s.
 *
 * Mapping is total for the three directories below: every jpg/jpeg/png in
 * them has every rung (scripts/gen-opt-images.py writes the missing ones;
 * Pillow, quality 80, method 4; tests/image-loader.test.ts fails if a file
 * is absent). Anything else - video posters, brand marks, the OG image -
 * passes through untouched.
 *
 * 160/320/480 were added 2026-11-21: the smallest rung used to be 640, so
 * the 48px review avatar and the ~100px menu thumbnails on the ad landing
 * pages each downloaded a 640px file (PageSpeed: 209 KiB wasted on mobile).
 */
const OPTIMIZED = /^\/(gallery|images\/hero|images\/menu)\/([^/]+)\.(?:jpe?g|png)$/i
export const LADDER = [160, 320, 480, 640, 960, 1280, 1920] as const
export const OPTIMIZED_DIRS = ["gallery", "images/hero", "images/menu"] as const

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  const match = OPTIMIZED.exec(src)
  if (!match) return src
  const rung = LADDER.find((w) => w >= width) ?? LADDER[LADDER.length - 1]
  return `/_opt/${match[1]}/${match[2]}-${rung}.webp`
}
