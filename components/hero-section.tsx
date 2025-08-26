"use client"
import { useState, useEffect, useRef } from "react"
import { Play } from "lucide-react"

export default function HeroSection() {
  const [isMobile, setIsMobile] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(true)
  const [userHasInteracted, setUserHasInteracted] = useState(false)
  const [showContent, setShowContent] = useState(true)
  const [currentVolume, setCurrentVolume] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Volume fade functions
  const fadeVolumeIn = () => {
    if (!videoRef.current) return
    
    const video = videoRef.current
    video.muted = false
    video.volume = 0
    setCurrentVolume(0)
    setIsVideoMuted(false)
    setShowContent(false) // Hide content when sound is enabled
    
    // Clear previous timer
    if (fadeTimeoutRef.current) {
      clearInterval(fadeTimeoutRef.current)
    }
    
    // Gradually increase volume
    let volume = 0
    const targetVolume = 0.7 // Target volume, not too loud
    const fadeStep = 0.02 // Volume increase per step
    const fadeInterval = 50 // Increase every 50ms
    
    fadeTimeoutRef.current = setInterval(() => {
      volume += fadeStep
      if (volume >= targetVolume) {
        volume = targetVolume
        clearInterval(fadeTimeoutRef.current!)
      }
      video.volume = volume
      setCurrentVolume(volume)
    }, fadeInterval)
  }

  const fadeVolumeOut = () => {
    if (!videoRef.current) return
    
    const video = videoRef.current
    let volume = video.volume
    
    // Clear previous timer
    if (fadeTimeoutRef.current) {
      clearInterval(fadeTimeoutRef.current)
    }
    
    // Gradually decrease volume
    const fadeStep = 0.05 // Volume decrease per step
    const fadeInterval = 30 // Decrease every 30ms
    
    fadeTimeoutRef.current = setInterval(() => {
      volume -= fadeStep
      if (volume <= 0) {
        volume = 0
        video.muted = true
        setIsVideoMuted(true)
        setShowContent(true) // Restore content display when sound is muted
        clearInterval(fadeTimeoutRef.current!)
      }
      video.volume = volume
      setCurrentVolume(volume)
    }, fadeInterval)
  }

  const toggleVideoAudio = () => {
    if (videoRef.current) {
      if (isVideoMuted) {
        fadeVolumeIn()
      } else {
        fadeVolumeOut()
      }
    }
  }



  const handleFirstInteraction = () => {
    if (!userHasInteracted) {
      setUserHasInteracted(true)
      
      // First click: enable sound (fadeVolumeIn will handle hiding content)
      fadeVolumeIn()
    }
  }

  const handleVideoClick = () => {
    if (!userHasInteracted) {
      // First click: hide content and enable sound
      handleFirstInteraction()
    } else {
      // Subsequent clicks: toggle sound on/off
      toggleVideoAudio()
    }
  }

  // Detect mobile devices
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Set initial value
    handleResize()

    // Add event listener
    window.addEventListener("resize", handleResize)

    // Cleanup
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Handle video audio state
  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current
      // Initialize video as muted
      video.muted = true
      video.volume = 0
      setIsVideoMuted(true)
      setCurrentVolume(0)
    }
  }, [])

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        clearInterval(fadeTimeoutRef.current)
      }
    }
  }, [])

  return (
    <section className="relative h-screen min-h-[600px] flex items-center justify-center">
      {/* Full-screen flame video background */}
      <div 
        className="absolute inset-0 overflow-hidden bg-black z-0"
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover cursor-pointer"
          autoPlay
          muted={isVideoMuted}
          loop
          playsInline
          poster="/images/hibachi-dinner-party.jpg"
          onClick={handleVideoClick}
        >
          <source src="/video/00ebf7a19327d6f30078329b3e163952.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {/* Slight dark overlay to make text clearer */}
        <div 
          className="absolute inset-0 bg-black/40 cursor-pointer z-10" 
          onClick={handleVideoClick}
        ></div>


      </div>

      {/* Main content area - hidden after click */}
      {showContent && (
        <div 
          className="container mx-auto px-4 relative z-30 text-center text-white h-full flex flex-col justify-center items-center transition-all duration-1000"
        >
          {/* Main title area - centered display */}
          <div className="relative max-w-4xl mx-auto">
            {/* Main welcome message */}
            <div className="mb-16">
              <h1 
                className="text-5xl md:text-7xl font-black mb-6 cursor-pointer transition-all duration-500 hover:scale-105 group relative pointer-events-auto"
                onClick={handleVideoClick}
                style={{
                  textShadow: "3px 3px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000, 4px 4px 8px rgba(0,0,0,0.5)",
                  animation: "gentlePulse 4s ease-in-out infinite"
                }}
              >
                <span className="text-orange-500 font-handwritten group-hover:text-orange-400 transition-colors duration-300" style={{
                  fontWeight: "700",
                  transform: "rotate(-2deg)",
                  display: "inline-block"
                }}>
                  Hibachi
                </span>{" "}
                <span className="font-handwritten group-hover:text-orange-200 transition-colors duration-300" style={{
                  color: "#F5E3CB",
                  fontWeight: "700",
                  transform: "rotate(1deg)",
                  display: "inline-block",
                  textShadow: "2px 2px 0px hsl(24.6, 85%, 35%), -1px -1px 0px hsl(24.6, 85%, 35%), 1px -1px 0px hsl(24.6, 85%, 35%), -1px 1px 0px hsl(24.6, 85%, 35%)"
                }}>
                  at Home
                </span>
                
                {/* 播放图标 - 减小尺寸 */}
                <span className="inline-flex items-center ml-2 group-hover:scale-110 transition-transform duration-300" style={{
                  transform: "translateY(-4px)"
                }}>
                  <div className="bg-orange-500/20 hover:bg-orange-500/40 rounded-full p-1.5 border border-orange-400/60 group-hover:border-orange-300 transition-all duration-300 backdrop-blur-sm">
                    <Play 
                      className="w-3 h-3 md:w-4 md:h-4 text-orange-300 group-hover:text-orange-200 transition-colors duration-300" 
                      fill="currentColor"
                    />
                  </div>
                </span>
                
           
              </h1>
              <p className="text-xl md:text-2xl drop-shadow-lg" style={{
                color: "hsl(24.6, 60%, 85%)"
              }}>
                Professional hibachi chefs bring the restaurant experience to your home
              </p>
            </div>

            {/* Call-to-action banner */}
            <div
              className="bg-gradient-to-r from-orange-600 via-red-600 to-yellow-600 text-white py-2 px-4 md:py-4 md:px-8 rounded-md md:rounded-lg transform hover:rotate-[-0.5deg] hover:scale-105 transition-all duration-300 shadow-2xl border-2 border-yellow-300"
              style={{
                backgroundImage: "linear-gradient(135deg, #ea580c 0%, #dc2626 50%, #d97706 100%)",
                boxShadow: "0 8px 16px rgba(0, 0, 0, 0.4), 0 0 0 2px rgba(255, 215, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
              }}
            >
              <p className="text-lg md:text-2xl lg:text-3xl font-bold tracking-wide text-yellow-50">🎉 Want a Party? One Call, That's All! 🎉</p>
            </div>


          </div>
        </div>
      )}


    </section>
  )
}