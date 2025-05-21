import type { ImageLoaderProps } from "next/image"

export default function customImageLoader({ src, width, quality }: ImageLoaderProps) {
  // 检查是否是外部URL
  if (src.startsWith("http")) {
    return src
  }

  // 检查是否是占位符
  if (src.startsWith("/placeholder.svg")) {
    return src
  }

  // 处理内部图片
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  return `${baseUrl}${src}?w=${width}&q=${quality || 75}`
}
