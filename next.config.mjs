/** @type {import('next').NextConfig} */

// Every alternate/mirror hostname pointed at this deployment must 301 to the
// canonical host, otherwise Google indexes duplicate copies of the whole site
// (hibachidoge.com and hibachifamily.party were indexed as mirrors).
const MIRROR_HOSTS = [
  "realhibachi.com",
  "hibachidoge.com",
  "www.hibachidoge.com",
  "hibachifamily.party",
  "www.hibachifamily.party",
]

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
    return [
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
      ...MIRROR_HOSTS.map((host) => ({
        source: "/:path*",
        has: [{ type: "host", value: host }],
        destination: "https://www.realhibachi.com/:path*",
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
