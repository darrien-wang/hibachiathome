export interface InstagramVideo {
  id: string
  videoUrl: string
  thumbnailUrl: string
  caption: string
  date: string
  location?: string
  eventType?: string
  likes?: number
  views?: number
  isEmbedded?: boolean
  embedUrl?: string
}

export const instagramVideos: InstagramVideo[] = [
  {
    id: "real-7",
    videoUrl: "",
    thumbnailUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=500&fit=crop&crop=center",
    caption: "Chef preparing hibachi meal at home service",
    date: "2024-02-12",
    location: "Manhattan Beach, CA",
    isEmbedded: true,
    embedUrl: "https://www.instagram.com/reel/DL8Qss3hFML/?utm_source=ig_embed&utm_campaign=loading"
  },
  {
    id: "real-6",
    videoUrl: "",
    thumbnailUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=500&fit=crop&crop=center",
    caption: "Hibachi chef preparing dinner service",
    date: "2024-02-08",
    location: "Santa Monica, CA",
    isEmbedded: true,
    embedUrl: "https://www.instagram.com/reel/DMMFjlwSxUJ/?utm_source=ig_embed&utm_campaign=loading"
  },
  {
    id: "real-5",
    videoUrl: "",
    thumbnailUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=500&fit=crop&crop=center",
    caption: "Chef demonstrating hibachi cooking techniques",
    date: "2024-02-05",
    location: "Pasadena, CA",
    isEmbedded: true,
    embedUrl: "https://www.instagram.com/reel/DL-5OroBk_p/?utm_source=ig_embed&utm_campaign=loading"
  },
  {
    id: "real-4",
    videoUrl: "",
    thumbnailUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=500&fit=crop&crop=center",
    caption: "Private hibachi dining experience",
    date: "2024-02-02",
    location: "West Hollywood, CA",
    isEmbedded: true,
    embedUrl: "https://www.instagram.com/reel/DL1EJdFp9lp/?utm_source=ig_embed&utm_campaign=loading"
  },
  {
    id: "real-3",
    videoUrl: "",
    thumbnailUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=500&fit=crop&crop=center",
    caption: "Professional hibachi chef preparing fresh ingredients with traditional techniques",
    date: "2024-01-30",
    location: "Beverly Hills, CA",
    isEmbedded: true,
    embedUrl: "https://www.instagram.com/reel/DMRam_WxzRU/?utm_source=ig_embed&utm_campaign=loading"
  },
  {
    id: "real-2",
    videoUrl: "",
    thumbnailUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=500&fit=crop&crop=center",
    caption: "Professional hibachi chef cooking at private home event",
    date: "2024-01-25",
    location: "Orange County, CA",
    isEmbedded: true,
    embedUrl: "https://www.instagram.com/reel/DMlUBJOyrh8/?utm_source=ig_embed&utm_campaign=loading"
  },
  {
    id: "real-1",
    videoUrl: "",
    thumbnailUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=500&fit=crop&crop=center",
    caption: "Hibachi chef demonstrating traditional cooking techniques",
    date: "2024-01-20",
    location: "Los Angeles, CA",
    isEmbedded: true,
    embedUrl: "https://www.instagram.com/reel/DNBj1r7yWvq/?utm_source=ig_embed&utm_campaign=loading"
  }
]

// 按日期排序（最新在前）
export const getLatestVideos = (count?: number) => {
  const sorted = [...instagramVideos].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return count ? sorted.slice(0, count) : sorted
}

// 按地点筛选
export const getVideosByLocation = (location: string) => {
  return instagramVideos.filter(video => video.location?.includes(location))
}

// 获取热门视频（按日期排序，最新的视频被认为是热门的）
export const getPopularVideos = (count?: number) => {
  const sorted = [...instagramVideos].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return count ? sorted.slice(0, count) : sorted
}
