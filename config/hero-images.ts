// 轮播图片配置
export interface HeroImage {
  url: string
  alt: string
  priority?: number // 可选的优先级字段，数字越小优先级越高
  duration?: number // 可选的显示时间（毫秒）
}

// 轮播配置
export interface CarouselConfig {
  interval: number // 轮播间隔时间（毫秒）
  transition: number // 过渡动画时间（毫秒）
  autoplayAfterInteraction: boolean // 是否在用户交互后自动播放
  firstSlideDuration: number // 首张幻灯片的显示时间（毫秒）
}

// 默认轮播配置
export const carouselConfig: CarouselConfig = {
  interval: 5000, // 5秒切换一次
  transition: 500, // 过渡动画持续0.5秒
  autoplayAfterInteraction: true, // 用户交互后自动播放
  firstSlideDuration: 10000, // 首张幻灯片显示10秒
}

export const heroImages: HeroImage[] = [
  {
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/ChatGPT%20Image%20May%2019%2C%202025%2C%2012_09_48%20AM-nfrN2RlFbVT5NJuQKq4AHsBN1fHiDp.png",
    alt: "Hibachi chef cooking with flames",
    priority: 1, // 最高优先级，确保作为首图
    duration: carouselConfig.firstSlideDuration, // 使用配置中的首张幻灯片显示时间
  },
  {
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/banner5-QXDgD4u9YK9SAwtGBCSDADdrM5YNG1.jpg",
    alt: "Hibachi chef cooking with flames",
    priority: 2,
    timestamp: "2025-05-15",
  },
  {
    url: "https://live.staticflickr.com/65535/53336755436_3c614274cd_b.jpg",
    alt: "Hibachi chef cooking at home party",
    priority: 3,
  },

  // 新增的4张轮播图
  {
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/banner-xN3z5y6ICfaVbAUl5fGRtovtIMuRem.jpg",
    alt: "Professional hibachi chef preparing meal",
    priority: 5,
  },
  {
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/banner2-gGtPpZjmEvOwNHxapy4YBFmbbbuhKk.jpg",
    alt: "Hibachi grill with delicious food",
    priority: 6,
  },
  {
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/banner4-gzupE1yCoJ0UA36Gm8v3BMNHdVfA5Q.jpg",
    alt: "Elegant hibachi dining experience",
    priority: 8,
  },
]

// 获取排序后的图片数组
export function getSortedHeroImages(): HeroImage[] {
  return [...heroImages].sort((a, b) => (a.priority || 999) - (b.priority || 999))
}
