/** @type {import('next').NextConfig} */

// Bare-apex PAGES must 301 to the canonical www host, otherwise Google
// indexes duplicate copies of the whole site. /api is exempt — see the
// redirects() rule below.
//
// hibachidoge.com and hibachifamily.party used to redirect here as well, after
// both were indexed as mirrors. Neither domain resolves any more (NXDOMAIN on
// 2026-08-28), so those four rules matched nothing and are gone. If either is
// ever re-registered and pointed at this deployment, add it back here before
// it can be indexed as a mirror again.
const MIRROR_HOSTS = ["realhibachi.com"]

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Internal chef handbook. Served as a standalone static file so its own
  // stylesheet does not collide with the site chrome. Deliberately NOT in
  // sitemap.ts and NOT disallowed in robots.ts - a robots.txt Disallow would
  // publish the path to anyone who reads robots.txt. noindex headers + meta
  // tags keep it out of search results instead.
  async rewrites() {
    return [
      {
        source: "/chef-handbook",
        destination: "/chef-handbook.html",
      },
    ]
  },
  async headers() {
    // Baseline security headers applied to every route. Intentionally omits a
    // Content-Security-Policy: the site loads Google Maps, GA, and Stripe, so
    // a CSP must be authored separately (start with Report-Only) to avoid
    // breaking those third parties. HSTS uses includeSubDomains but NOT
    // preload - add `; preload` and submit to hstspreload.org only once every
    // subdomain is guaranteed HTTPS, since preload is hard to reverse.
    const securityHeaders = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ]

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/chef-handbook",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/chef-handbook.html",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ]
  },
  async redirects() {
    return [
      // /api is exempt from the host redirect: Stripe (and other webhook
      // providers) POST to the registered URL and do not follow redirects,
      // so API routes must answer on every host directly. Pages still 308
      // to the canonical www host. The apex domain must therefore be
      // attached to the Vercel project WITHOUT a domain-level redirect,
      // or requests never reach these rules (incident 2026-09-01).
      ...MIRROR_HOSTS.map((host) => ({
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: host }],
        destination: "https://www.realhibachi.com/:path",
        permanent: true,
      })),
      // East Coast market discontinued (2026-07): SoCal only
      {
        source: "/locations/nyc-long-island",
        destination: "/locations/la-orange-county",
        permanent: true,
      },
      // Quote A/B routes consolidated into /quote (2026-08). The split test
      // never ran - see config/quote-features.ts. These links are in the wild
      // (blog posts, city pages, Marketplace replies), so keep them redirecting.
      {
        source: "/quoteA",
        destination: "/quote",
        permanent: true,
      },
      {
        source: "/quoteB",
        destination: "/quote",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
