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
    url: "/images/chef-bling-at-the-grill.jpg",
    alt: "Real Hibachi chef performing at the grill",
    priority: 1, // 最高优先级，确保作为首图
    duration: carouselConfig.firstSlideDuration, // 使用配置中的首张幻灯片显示时间
  },
  {
    url: "/images/hero/banner5.jpg",
    alt: "Hibachi chef cooking with flames",
    priority: 2,
  },
  {
    url: "/images/hibachi-dinner-party.jpg",
    alt: "Hibachi chef cooking at home party",
    priority: 3,
  },
  {
    url: "/images/hero/banner.jpg",
    alt: "Professional hibachi chef preparing meal",
    priority: 5,
  },
  {
    url: "/images/hero/banner4.jpg",
    alt: "Elegant hibachi dining experience",
    priority: 8,
  },
]

// 获取排序后的图片数组
export function getSortedHeroImages(): HeroImage[] {
  return [...heroImages].sort((a, b) => (a.priority || 999) - (b.priority || 999))
}
