// 轮播图片配置
export interface HeroImage {
  url: string
  alt: string
  priority?: number // 可选的优先级字段，数字越小优先级越高
}

// 轮播配置
export interface CarouselConfig {
  interval: number // 轮播间隔时间（毫秒）
  transition: number // 过渡动画时间（毫秒）
}

// 默认轮播配置
export const carouselConfig: CarouselConfig = {
  interval: 5000, // 5秒切换一次（原来可能是3秒，现在增加2秒）
  transition: 500, // 过渡动画持续0.5秒
}

export const heroImages: HeroImage[] = [
  {
    url: "https://live.staticflickr.com/65535/53336755436_3c614274cd_b.jpg",
    alt: "Hibachi chef cooking at home party",
    priority: 1,
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
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/banner3-RRJ8sTikDnZjukYjncPEnJQkklZJpZ.jpg",
    alt: "Hibachi chef performing cooking show",
    priority: 7,
  },
  {
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/banner4-gzupE1yCoJ0UA36Gm8v3BMNHdVfA5Q.jpg",
    alt: "Elegant hibachi dining experience",
    priority: 8,
  },
    {
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250514132251-CecaVfadScFYbfD1eg3HcM8jTxxgzi.png",
    alt: "Hibachi chef cooking with flames",
    priority: 9,
  },
]

// 获取排序后的图片数组
export function getSortedHeroImages(): HeroImage[] {
  return [...heroImages].sort((a, b) => (a.priority || 999) - (b.priority || 999))
}
