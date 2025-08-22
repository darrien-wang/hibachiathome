"use client"

import { useState, useRef, useEffect } from "react"

// 声明全局Instagram对象类型
declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process(): void
      }
    }
  }
}
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Play, MapPin, Calendar, ChevronLeft, ChevronRight, Instagram, ExternalLink } from "lucide-react"
import { getLatestVideos, type InstagramVideo } from "@/config/instagram-videos"

interface InstagramVideosSectionProps {
  displayMode?: "grid" | "carousel"
  maxVisible?: number
  showViewAll?: boolean
  title?: string
  subtitle?: string
}

export default function InstagramVideosSection({
  displayMode = "grid",
  maxVisible = 6,
  showViewAll = true,
  title = "Real Events, Real Moments",
  subtitle = "See our recent hibachi experiences from satisfied customers"
}: InstagramVideosSectionProps) {
  const [videos, setVideos] = useState<InstagramVideo[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})
  const carouselRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const latestVideos = getLatestVideos()
    setVideos(latestVideos)

    // 检测是否为移动设备
    const checkIsMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth < 768
      setIsMobile(isMobileDevice)
    }
    
    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)

    // 加载Instagram嵌入脚本
    const loadInstagramScript = () => {
      if (window.instgrm) {
        window.instgrm.Embeds.process()
        return
      }

      const script = document.createElement('script')
      script.async = true
      script.src = '//www.instagram.com/embed.js'
      script.onload = () => {
        if (window.instgrm) {
          window.instgrm.Embeds.process()
        }
      }
      document.body.appendChild(script)
    }

    // 检查是否有嵌入式视频
    const hasEmbeddedVideos = latestVideos.some(video => video.isEmbedded)
    if (hasEmbeddedVideos) {
      loadInstagramScript()
    }

    return () => {
      window.removeEventListener('resize', checkIsMobile)
    }
  }, [])

  const displayedVideos = showAll ? videos : videos.slice(0, maxVisible)
  const hasMore = videos.length > maxVisible

  const handleVideoPlay = (videoId: string) => {
    // 暂停其他正在播放的视频
    Object.entries(videoRefs.current).forEach(([id, video]) => {
      if (id !== videoId && video) {
        video.pause()
      }
    })
    setPlayingVideo(videoId)
  }

  const handleVideoRef = (videoId: string, ref: HTMLVideoElement | null) => {
    videoRefs.current[videoId] = ref
  }

  const nextSlide = () => {
    if (displayMode === "carousel" && carouselRef.current) {
      const scrollAmount = 320 // width of one card + gap
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  const prevSlide = () => {
    if (displayMode === "carousel" && carouselRef.current) {
      const scrollAmount = 320 // width of one card + gap
      carouselRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  const formatNumber = (num?: number) => {
    if (!num) return "0"
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k"
    }
    return num.toString()
  }

  return (
    <section className="py-16 bg-gradient-to-br from-gray-50 to-stone-100">
      <div className="container mx-auto px-4">
        <AnimateOnScroll direction="down">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Instagram className="h-8 w-8 text-pink-500" />
              <h2 className="text-4xl md:text-5xl font-serif font-bold">
                {title}
              </h2>
            </div>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {subtitle}
            </p>
          </div>
        </AnimateOnScroll>

        {displayMode === "grid" ? (
          <>
            <AnimateOnScroll>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 items-start">
                {displayedVideos.map((video, index) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    index={index}
                    onVideoPlay={handleVideoPlay}
                    onVideoRef={handleVideoRef}
                    playingVideo={playingVideo}
                  />
                ))}
              </div>
            </AnimateOnScroll>

            {showViewAll && hasMore && (
              <AnimateOnScroll direction="up">
                <div className="text-center">
                  <Button
                    onClick={() => setShowAll(!showAll)}
                    variant="outline"
                    className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50 px-8 py-3"
                  >
                    <Instagram className="h-4 w-4 mr-2" />
                    {showAll ? "Show Less" : `View All ${videos.length} Videos`}
                  </Button>
                </div>
              </AnimateOnScroll>
            )}
          </>
        ) : (
          <AnimateOnScroll>
            <div className="relative mx-auto px-4">
              {/* Desktop navigation arrows */}
              {!isMobile && (
                <>
                  <button
                    onClick={prevSlide}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 transition-all duration-200 hover:scale-110"
                    aria-label="Previous videos"
                  >
                    <ChevronLeft className="h-6 w-6 text-gray-700" />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 transition-all duration-200 hover:scale-110"
                    aria-label="Next videos"
                  >
                    <ChevronRight className="h-6 w-6 text-gray-700" />
                  </button>
                </>
              )}
              
              <div 
                ref={carouselRef}
                className="overflow-x-auto scrollbar-hide"
                style={{ 
                  scrollBehavior: 'smooth',
                  scrollSnapType: 'x mandatory'
                }}
              >
                <div className="flex gap-4 pb-4 md:gap-6">
                  {videos.map((video, index) => (
                    <div 
                      key={video.id} 
                      className="w-[280px] sm:w-[320px] md:w-[350px] flex-shrink-0"
                      style={{ scrollSnapAlign: 'start' }}
                    >
                      <VideoCard
                        video={video}
                        index={index}
                        onVideoPlay={handleVideoPlay}
                        onVideoRef={handleVideoRef}
                        playingVideo={playingVideo}
                        isCarousel={true}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Navigation hints based on device type */}
              <div className="text-center mt-2">
                {isMobile ? (
                  <p className="text-sm text-gray-500">← Swipe to see more videos →</p>
                ) : (
                  <p className="text-sm text-gray-500">← Use arrow buttons or scroll to see more videos →</p>
                )}
              </div>
            </div>
          </AnimateOnScroll>
        )}
      </div>
    </section>
  )
}

interface VideoCardProps {
  video: InstagramVideo
  index: number
  onVideoPlay: (id: string) => void
  onVideoRef: (id: string, ref: HTMLVideoElement | null) => void
  playingVideo: string | null
  isCarousel?: boolean
}

function VideoCard({ video, index, onVideoPlay, onVideoRef, playingVideo, isCarousel = false }: VideoCardProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [showVideo, setShowVideo] = useState(false)

  // Instagram嵌入视频在组件加载时直接显示
  useEffect(() => {
    if (video.isEmbedded) {
      // 延迟处理Instagram嵌入，确保DOM更新完成
      setTimeout(() => {
        if (window.instgrm) {
          window.instgrm.Embeds.process()
        }
      }, 100)
    }
  }, [video.isEmbedded])

  const handlePlayClick = () => {
    if (video.isEmbedded) {
      // Instagram嵌入视频直接跳转到Instagram
      if (video.embedUrl) {
        window.open(video.embedUrl, '_blank')
      }
    } else {
      setShowVideo(true)
      onVideoPlay(video.id)
    }
  }

  const handleInstagramClick = () => {
    if (video.embedUrl) {
      window.open(video.embedUrl, '_blank')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    })
  }

  return (
    <AnimateOnScroll delay={isCarousel ? 0 : index * 100} direction="up">
      <Card className={`overflow-hidden hover:shadow-xl transition-all duration-300 group ${
        isCarousel ? 'h-[380px] sm:h-[400px]' : ''
      }`}>
        <CardContent className="p-0">
          {video.isEmbedded ? (
            // Instagram直接嵌入
            <div className={`relative bg-white ${
              isCarousel ? 'h-[280px] sm:h-[300px]' : ''
            }`} style={{ minHeight: isCarousel ? 'auto' : '400px' }}>
              <blockquote 
                className="instagram-media" 
                data-instgrm-captioned 
                data-instgrm-permalink={video.embedUrl}
                data-instgrm-version="14"
                style={{
                  background: '#FFF',
                  border: 0,
                  borderRadius: '3px',
                  boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
                  margin: '1px',
                  maxWidth: '540px',
                  minWidth: '326px',
                  padding: 0,
                  width: '99.375%'
                }}
              >
                <div style={{ padding: '16px' }}>
                  <a href={video.embedUrl} style={{ background: '#FFFFFF', lineHeight: 0, padding: '0 0', textAlign: 'center', textDecoration: 'none', width: '100%' }} target="_blank" rel="noopener noreferrer">
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                      <div style={{ backgroundColor: '#F4F4F4', borderRadius: '50%', flexGrow: 0, height: '40px', marginRight: '14px', width: '40px' }}></div>
                      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
                        <div style={{ backgroundColor: '#F4F4F4', borderRadius: '4px', flexGrow: 0, height: '14px', marginBottom: '6px', width: '100px' }}></div>
                        <div style={{ backgroundColor: '#F4F4F4', borderRadius: '4px', flexGrow: 0, height: '14px', width: '60px' }}></div>
                      </div>
                    </div>
                    <div style={{ padding: '19% 0' }}></div>
                    <div style={{ display: 'block', height: '50px', margin: '0 auto 12px', width: '50px' }}>
                      <svg width="50px" height="50px" viewBox="0 0 60 60" version="1.1" xmlns="http://www.w3.org/2000/svg">
                        <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                          <g transform="translate(-511.000000, -20.000000)" fill="#000000">
                            <g>
                              <path d="M556.869,30.41 C554.814,30.41 553.148,32.076 553.148,34.131 C553.148,36.186 554.814,37.852 556.869,37.852 C558.924,37.852 560.59,36.186 560.59,34.131 C560.59,32.076 558.924,30.41 556.869,30.41 M541,60.657 C535.114,60.657 530.342,55.887 530.342,50 C530.342,44.114 535.114,39.342 541,39.342 C546.887,39.342 551.658,44.114 551.658,50 C551.658,55.887 546.887,60.657 541,60.657 M541,33.886 C532.1,33.886 524.886,41.1 524.886,50 C524.886,58.899 532.1,66.113 541,66.113 C549.9,66.113 557.115,58.899 557.115,50 C557.115,41.1 549.9,33.886 541,33.886 M565.378,62.101 C565.244,65.022 564.756,66.606 564.346,67.663 C563.803,69.06 563.154,70.057 562.106,71.106 C561.058,72.155 560.06,72.803 558.662,73.347 C557.607,73.757 556.021,74.244 553.102,74.378 C549.944,74.521 548.997,74.552 541,74.552 C533.003,74.552 532.056,74.521 528.898,74.378 C525.979,74.244 524.393,73.757 523.338,73.347 C521.94,72.803 520.942,72.155 519.894,71.106 C518.846,70.057 518.197,69.06 517.654,67.663 C517.244,66.606 516.755,65.022 516.623,62.101 C516.479,58.943 516.448,57.996 516.448,50 C516.448,42.003 516.479,41.056 516.623,37.899 C516.755,34.978 517.244,33.391 517.654,32.338 C518.197,30.938 518.846,29.942 519.894,28.894 C520.942,27.846 521.94,27.196 523.338,26.654 C524.393,26.244 525.979,25.756 528.898,25.623 C532.057,25.479 533.004,25.448 541,25.448 C548.997,25.448 549.943,25.479 553.102,25.623 C556.021,25.756 557.607,26.244 558.662,26.654 C560.06,27.196 561.058,27.846 562.106,28.894 C563.154,29.942 563.803,30.938 564.346,32.338 C564.756,33.391 565.244,34.978 565.378,37.899 C565.522,41.056 565.552,42.003 565.552,50 C565.552,57.996 565.522,58.943 565.378,62.101 M570.82,37.631 C570.674,34.438 570.167,32.258 569.425,30.349 C568.659,28.377 567.633,26.702 565.965,25.035 C564.297,23.368 562.623,22.342 560.652,21.575 C558.743,20.834 556.562,20.326 553.369,20.18 C550.169,20.033 549.148,20 541,20 C532.853,20 531.831,20.033 528.631,20.18 C525.438,20.326 523.257,20.834 521.349,21.575 C519.376,22.342 517.703,23.368 516.035,25.035 C514.368,26.702 513.342,28.377 512.574,30.349 C511.834,32.258 511.326,34.438 511.181,37.631 C511.035,40.831 511,41.851 511,50 C511,58.147 511.035,59.17 511.181,62.369 C511.326,65.562 511.834,67.743 512.574,69.651 C513.342,71.625 514.368,73.296 516.035,74.965 C517.703,76.634 519.376,77.658 521.349,78.425 C523.257,79.167 525.438,79.673 528.631,79.82 C531.831,79.965 532.853,80.001 541,80.001 C549.148,80.001 550.169,79.965 553.369,79.82 C556.562,79.673 558.743,79.167 560.652,78.425 C562.623,77.658 564.297,76.634 565.965,74.965 C567.633,73.296 568.659,71.625 569.425,69.651 C570.167,67.743 570.674,65.562 570.82,62.369 C570.966,59.17 571,58.147 571,50 C571,41.851 570.966,40.831 570.82,37.631"></path>
                            </g>
                          </g>
                        </g>
                      </svg>
                    </div>
                    <div style={{ paddingTop: '8px' }}>
                      <div style={{ color: '#3897f0', fontFamily: 'Arial,sans-serif', fontSize: '14px', fontStyle: 'normal', fontWeight: 550, lineHeight: '18px' }}>
                        View this post on Instagram
                      </div>
                    </div>
                  </a>
                  <p style={{ color: '#c9c8cd', fontFamily: 'Arial,sans-serif', fontSize: '14px', lineHeight: '17px', marginBottom: 0, marginTop: '8px', overflow: 'hidden', padding: '8px 0 7px', textAlign: 'center', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <a href={video.embedUrl} style={{ color: '#c9c8cd', fontFamily: 'Arial,sans-serif', fontSize: '14px', fontStyle: 'normal', fontWeight: 'normal', lineHeight: '17px', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
                      A post shared by Real Hibachi (@realhibachi)
                    </a>
                  </p>
                </div>
              </blockquote>
              

            </div>
          ) : (
            // 普通视频显示
            <div className={`relative bg-gray-100 ${
              isCarousel ? 'h-[280px] sm:h-[300px]' : 'aspect-[4/5]'
            }`}>
              {showVideo ? (
                <video
                  ref={(ref) => onVideoRef(video.id, ref)}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  muted
                  onLoadedData={() => setIsLoaded(true)}
                  poster={video.thumbnailUrl}
                >
                  <source src={video.videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <>
                  <img
                    src={video.thumbnailUrl}
                    alt={video.caption}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onLoad={() => setIsLoaded(true)}
                    onError={(event) => {
                      const img = event.target as HTMLImageElement
                      img.src = '/placeholder.svg'
                    }}
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors duration-300" />
                  <button
                    onClick={handlePlayClick}
                    className="absolute inset-0 flex items-center justify-center group"
                  >
                    <div className="bg-white/90 rounded-full p-4 group-hover:bg-white group-hover:scale-110 transition-all duration-300 shadow-lg">
                      <Play className="h-8 w-8 text-gray-800 ml-1" fill="currentColor" />
                    </div>
                  </button>
                </>
              )}

            </div>
          )}
          
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
              {video.caption}
            </p>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-3">
                {video.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{video.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(video.date)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end pt-2 border-t border-gray-100">
              {video.isEmbedded ? (
                <button
                  onClick={handleInstagramClick}
                  className="flex items-center gap-1 text-xs text-pink-500 hover:text-pink-600 transition-colors"
                >
                  <Instagram className="h-3 w-3" />
                  <ExternalLink className="h-3 w-3" />
                </button>
              ) : (
                <Instagram className="h-4 w-4 text-pink-500" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>


    </AnimateOnScroll>
  )
}
