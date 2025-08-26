"use client"
import { useState, useEffect, useRef } from "react"
import { Play } from "lucide-react"

export default function HeroSection() {
  const [isMobile, setIsMobile] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(true)
  const [userHasInteracted, setUserHasInteracted] = useState(false)
  const [showContent, setShowContent] = useState(true)
  const [isRotating, setIsRotating] = useState(false)
  const [isFadingIn, setIsFadingIn] = useState(false)
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
    
    // Reset fade-in state and start rotation animation
    setIsFadingIn(false)
    setIsRotating(true)
    
    // Hide content after rotation animation (1 second)
    setTimeout(() => {
      setShowContent(false)
    }, 1000)
    
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
    
    // Reset rotation state and start fade in animation
    setIsRotating(false)
    setIsFadingIn(true)
    setShowContent(true)
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

  // Handle video audio state and Safari compatibility
  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current
      // Initialize video as muted
      video.muted = true
      video.volume = 0
      setIsVideoMuted(true)
      setCurrentVolume(0)
      
      // Safari specific fixes
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
      if (isSafari) {
        // Force load the video
        video.load()
        
        // Try to play after a short delay for Safari
        const playVideo = async () => {
          try {
            await video.play()
          } catch (error) {
            console.log('Safari autoplay prevented:', error)
            // Safari might prevent autoplay, this is expected
          }
        }
        
        // Add event listeners for Safari
        video.addEventListener('loadeddata', playVideo)
        video.addEventListener('canplay', playVideo)
        
        return () => {
          video.removeEventListener('loadeddata', playVideo)
          video.removeEventListener('canplay', playVideo)
        }
      }
    }
  }, [])

  // Reset fade-in state after animation completes
  useEffect(() => {
    if (isFadingIn) {
      const timer = setTimeout(() => {
        setIsFadingIn(false)
      }, 800) // Match animation duration
      
      return () => clearTimeout(timer)
    }
  }, [isFadingIn])

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
          webkit-playsinline="true"
          preload="auto"
          poster="/images/hibachi-dinner-party.jpg"
          onClick={handleVideoClick}
          style={{ willChange: 'transform' }}
        >
          <source src="/video/00ebf7a19327d6f30078329b3e163952.mp4" type="video/mp4; codecs='avc1.42E01E, mp4a.40.2'" />
          <source src="/video/00ebf7a19327d6f30078329b3e163952.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {/* Dynamic dark overlay - hidden when sound is playing, shown when muted */}
        <div 
          className={`absolute inset-0 cursor-pointer z-10 transition-all duration-1000 ${
            !isVideoMuted && currentVolume > 0 
              ? 'bg-black/0' 
              : 'bg-black/40'
          }`}
          onClick={handleVideoClick}
        ></div>


      </div>

      {/* Main content area - hidden after click */}
      {showContent && (
        <div 
          className={`container mx-auto px-4 relative z-30 text-center text-white h-full flex flex-col justify-center items-center ${
            isRotating ? 'rotate-and-fade' : 
            isFadingIn ? 'fade-in-up' : 
            'transition-all duration-300'
          }`}
        >
          {/* Main title area - centered display */}
          <div className="relative max-w-4xl mx-auto">
            {/* Main welcome message */}
            <div className="mb-8 relative">
              <h1 
                className="text-5xl md:text-7xl font-black mb-8 cursor-pointer transition-all duration-500 hover:scale-105 group relative pointer-events-auto"
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
              </h1>



              <p className="text-xl md:text-2xl drop-shadow-lg" style={{
                color: "hsl(24.6, 60%, 85%)"
              }}>
                Professional hibachi chefs bring the restaurant experience to your home
              </p>
            </div>

            {/* Call-to-action buttons group */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {/* Watch Video Button */}
              <button
                onClick={handleVideoClick}
                className="bg-black/60 hover:bg-black/80 text-white py-3 px-6 rounded-full transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl border-2 border-orange-400 hover:border-orange-300 backdrop-blur-sm flex items-center gap-2"
              >
                <Play 
                  className="w-4 h-4 text-orange-300 hover:text-orange-200 transition-colors duration-300" 
                  fill="currentColor"
                />
                <span className="text-sm md:text-base font-medium">Watch Video</span>
              </button>
            </div>


          </div>
        </div>
      )}


    </section>
  )
}