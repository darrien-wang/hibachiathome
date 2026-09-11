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
 * them has all four rungs (see scratch gen-opt.py; regenerate with PIL,
 * quality 80, method 4). Anything else - video posters, brand marks, the
 * OG image - passes through untouched.
 */
const OPTIMIZED = /^\/(gallery|images\/hero|images\/menu)\/([^/]+)\.(?:jpe?g|png)$/i
const LADDER = [640, 960, 1280, 1920] as const

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  const match = OPTIMIZED.exec(src)
  if (!match) return src
  const rung = LADDER.find((w) => w >= width) ?? LADDER[LADDER.length - 1]
  return `/_opt/${match[1]}/${match[2]}-${rung}.webp`
}
