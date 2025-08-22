import { NextResponse } from 'next/server'

const BASE_URL = 'https://www.realhibachi.com'

export async function GET() {
  // Define videos with their metadata
  const videos = [
    {
      pageUrl: `${BASE_URL}`,
      videoTitle: "Real Hibachi at Home Experience",
      videoDescription: "Professional Japanese hibachi chef cooking authentic teppanyaki at home. Watch our skilled chefs perform amazing cooking tricks while preparing delicious hibachi meals in the comfort of your own home.",
      videoContentLoc: `${BASE_URL}/video/00ebf7a19327d6f30078329b3e163952.mp4`,
      videoThumbnailLoc: `${BASE_URL}/images/hibachi-dinner-party.jpg`,
      videoDuration: "120", // 2 minutes estimated
      videoExpirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 1 year from now
    }
  ]

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${videos.map(video => `  <url>
    <loc>${video.pageUrl}</loc>
    <video:video>
      <video:title><![CDATA[${video.videoTitle}]]></video:title>
      <video:description><![CDATA[${video.videoDescription}]]></video:description>
      <video:content_loc>${video.videoContentLoc}</video:content_loc>
      <video:thumbnail_loc>${video.videoThumbnailLoc}</video:thumbnail_loc>
      <video:duration>${video.videoDuration}</video:duration>
      <video:expiration_date>${video.videoExpirationDate}</video:expiration_date>
      <video:view_count>1000</video:view_count>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
    </video:video>
  </url>`).join('\n')}
</urlset>`

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}
