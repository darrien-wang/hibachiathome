"use client"
import { useState, useEffect, useRef } from "react"
import { Play } from "lucide-react"

export default function HeroSection() {
  // Start with false to avoid hydration mismatch, detect properly in useEffect
  const [isMobile, setIsMobile] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(true)
  const [userHasInteracted, setUserHasInteracted] = useState(false)
  const [showContent, setShowContent] = useState(true)
  const [isRotating, setIsRotating] = useState(false)
  const [isFadingIn, setIsFadingIn] = useState(false)
  const [currentVolume, setCurrentVolume] = useState(0)
  const [debugInfo, setDebugInfo] = useState('')
  const [showDebug, setShowDebug] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debug function
  const updateDebugInfo = () => {
    if (videoRef.current) {
      const video = videoRef.current
      const info = `
Video Status:
- Paused: ${video.paused}
- Muted: ${video.muted}
- Volume: ${video.volume}
- ReadyState: ${video.readyState}
- Current Time: ${video.currentTime.toFixed(2)}
- Duration: ${video.duration || 'Unknown'}
- User Interacted: ${userHasInteracted}
- Show Content: ${showContent}
- Is Mobile: ${isMobile}
- User Agent: ${navigator.userAgent.substring(0, 50)}...
- Network State: ${video.networkState} (0=EMPTY, 1=IDLE, 2=LOADING, 3=NO_SOURCE)
- Error Code: ${video.error?.code || 'None'} (1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED)
- Video Src: ${video.src}
      `.trim()
      setDebugInfo(info)
    }
  }

  // Update debug info periodically
  useEffect(() => {
    if (showDebug) {
      updateDebugInfo()
      const interval = setInterval(updateDebugInfo, 1000)
      return () => clearInterval(interval)
    }
  }, [showDebug, userHasInteracted, showContent, isMobile])

  // Client-side mobile detection to avoid hydration issues
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isMobileDevice = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const isMobileScreen = window.innerWidth < 768
    const shouldBeMobile = isMobileDevice || isMobileScreen
    
    console.log('Client-side mobile detection:', { 
      isIOS, 
      isMobileDevice, 
      isMobileScreen, 
      shouldBeMobile,
      userAgent: navigator.userAgent 
    })
    
    setIsMobile(shouldBeMobile)
    
    // Force update debug info after mobile detection
    setTimeout(updateDebugInfo, 100)
  }, [])

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

  const handleVideoClick = async () => {
    console.log('Video clicked! User has interacted:', userHasInteracted)
    
    if (videoRef.current) {
      const video = videoRef.current
      console.log('Video state:', {
        paused: video.paused,
        muted: video.muted,
        readyState: video.readyState,
        currentTime: video.currentTime,
        duration: video.duration
      })
      
      // If video is paused, try to play it first (important for iOS)
      if (video.paused) {
        try {
          console.log('Video is paused, attempting to play...')
          await video.play()
          console.log('Video play successful after click')
        } catch (error) {
          console.error('Failed to play video after click:', error)
        }
      }
    }
    
    if (!userHasInteracted) {
      // First click: hide content and enable sound
      handleFirstInteraction()
    } else {
      // Subsequent clicks: toggle sound on/off
      toggleVideoAudio()
    }
  }

  // Configure video and mobile handling after mobile detection
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isMobileDevice = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    const handleResize = () => {
      const newIsMobileScreen = window.innerWidth < 768
      const newShouldBeMobile = isMobileDevice || newIsMobileScreen
      setIsMobile(newShouldBeMobile)
      console.log('Resize detected:', { 
        newIsMobileScreen, 
        isMobileDevice, 
        newShouldBeMobile 
      })
    }
    
    // Configure video based on device type after mounting
    if (videoRef.current) {
      const video = videoRef.current
      
      if (isIOS || isMobileDevice) {
        console.log('Mobile device detected, setting up special handling...', { isIOS, isMobileDevice })
        
        // Force video to be ready for mobile
        video.muted = true
        video.autoplay = false // Disable autoplay for iOS
        video.preload = 'metadata' // Only load metadata first
      } else {
        console.log('Desktop detected, enabling autoplay...')
        
        // Desktop: enable autoplay
        video.autoplay = true
        video.preload = 'auto'
        video.muted = true
      }
    }
    
    if ((isIOS || isMobileDevice) && videoRef.current) {
      const video = videoRef.current
      
      // Force load the video
      console.log('Forcing video load...')
      video.load()
      
      // Add comprehensive event listeners
      const handleLoadStart = () => console.log('Mobile: loadstart event')
      const handleLoadedMetadata = () => {
        console.log('Mobile: loadedmetadata event, ReadyState:', video.readyState)
        updateDebugInfo()
      }
      const handleLoadedData = () => {
        console.log('Mobile: loadeddata event, ReadyState:', video.readyState)
        updateDebugInfo()
      }
      const handleCanPlay = () => {
        console.log('Mobile: canplay event, ReadyState:', video.readyState)
        updateDebugInfo()
      }
      
      // Add special mobile event handlers
      const mobilePlayHandler = async (event: Event) => {
        console.log('Mobile: User interaction detected, type:', event.type)
        try {
          if (video.paused) {
            console.log('Mobile: Attempting to play video...')
            video.preload = 'auto' // Now load full video
            await video.play()
            console.log('Mobile: Video playing successfully')
            updateDebugInfo()
          }
        } catch (error) {
          console.error('Mobile: Video play failed:', error)
        }
      }
      
      // Add event listeners
      video.addEventListener('loadstart', handleLoadStart)
      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      video.addEventListener('loadeddata', handleLoadedData)
      video.addEventListener('canplay', handleCanPlay)
      video.addEventListener('touchstart', mobilePlayHandler)
      video.addEventListener('click', mobilePlayHandler)
      
      // Try to load metadata immediately
      setTimeout(() => {
        console.log('Delayed load attempt...')
        video.load()
      }, 100)
      
      return () => {
        video.removeEventListener('loadstart', handleLoadStart)
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
        video.removeEventListener('loadeddata', handleLoadedData)
        video.removeEventListener('canplay', handleCanPlay)
        video.removeEventListener('touchstart', mobilePlayHandler)
        video.removeEventListener('click', mobilePlayHandler)
      }
    }

    // Add resize event listener
    window.addEventListener("resize", handleResize)

    // Cleanup
    return () => window.removeEventListener("resize", handleResize)
  }, [isMobile]) // Re-run when mobile state changes

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
            console.log('Attempting to play video on Safari...')
            const playPromise = await video.play()
            console.log('Video play successful:', playPromise)
          } catch (error: any) {
            console.error('Safari autoplay failed:', error.name, error.message)
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
      }, 600) // Match animation duration
      
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
          autoPlay={false}
          muted={isVideoMuted}
          loop
          playsInline
          webkit-playsinline="true"
          preload="metadata"
          controls={false}
          poster="/images/hibachi-dinner-party.jpg"
          onClick={handleVideoClick}
          suppressHydrationWarning
          onLoadStart={() => console.log('Video load started')}
          onLoadedData={() => console.log('Video data loaded')}
          onCanPlay={() => console.log('Video can play')}
          onPlay={() => console.log('Video started playing')}
          onPause={() => console.log('Video paused')}
          onError={(e) => {
            const video = e.target as HTMLVideoElement
            console.error('Video error details:', {
              error: e,
              target: video,
              networkState: video.networkState,
              readyState: video.readyState,
              src: video.src,
              currentSrc: video.currentSrc,
              errorCode: video.error?.code,
              errorMessage: video.error?.message,
              lastErrorEvent: e
            })
          }}
          style={{ willChange: 'transform' }}
        >
          <source 
            src="/video/00ebf7a19327d6f30078329b3e163952.mp4" 
            type="video/mp4; codecs='avc1.42E01E, mp4a.40.2'"
            onError={(e) => console.error('First source failed:', e.target)}
          />
          <source 
            src="/video/00ebf7a19327d6f30078329b3e163952.mp4" 
            type="video/mp4"
            onError={(e) => console.error('Second source failed:', e.target)}
          />
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
              
              {/* Debug button for mobile troubleshooting */}
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="mt-4 bg-red-600/60 hover:bg-red-700/80 text-white py-2 px-4 rounded-full text-xs"
              >
                {showDebug ? 'Hide' : 'Show'} Debug Info
              </button>
            </div>


          </div>
        </div>
      )}

      {/* Debug Panel for Mobile */}
      {showDebug && (
        <div className="fixed top-4 right-4 bg-black/90 text-white p-4 rounded-lg max-w-sm text-xs z-50 max-h-96 overflow-y-auto">
          <h3 className="font-bold mb-2 text-yellow-400">Video Debug Info</h3>
          <pre className="whitespace-pre-wrap font-mono">{debugInfo}</pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={async () => {
                if (videoRef.current) {
                  console.log('Force Play clicked')
                  try {
                    videoRef.current.muted = true
                    await videoRef.current.play()
                    updateDebugInfo()
                  } catch (error) {
                    console.error('Force play failed:', error)
                  }
                }
              }}
              className="bg-green-600 px-2 py-1 rounded text-xs"
            >
              Force Play
            </button>
            <button
              onClick={() => {
                if (videoRef.current) {
                  console.log('Reload Video clicked')
                  videoRef.current.load()
                  updateDebugInfo()
                }
              }}
              className="bg-blue-600 px-2 py-1 rounded text-xs"
            >
              Reload Video
            </button>
            <button
              onClick={() => {
                if (videoRef.current) {
                  console.log('Auto Preload clicked')
                  videoRef.current.preload = 'auto'
                  videoRef.current.load()
                  updateDebugInfo()
                }
              }}
              className="bg-purple-600 px-2 py-1 rounded text-xs"
            >
              Auto Preload
            </button>
            <button
              onClick={() => {
                if (videoRef.current) {
                  console.log('Enable Autoplay clicked')
                  videoRef.current.autoplay = true
                  videoRef.current.muted = true
                  videoRef.current.load()
                  updateDebugInfo()
                }
              }}
              className="bg-yellow-600 px-2 py-1 rounded text-xs"
            >
              Enable Autoplay
            </button>
            <button
              onClick={async () => {
                console.log('Testing video file accessibility...')
                try {
                  const response = await fetch('/video/00ebf7a19327d6f30078329b3e163952.mp4', { method: 'HEAD' })
                  console.log('Video file test:', {
                    status: response.status,
                    headers: Object.fromEntries(response.headers.entries()),
                    ok: response.ok
                  })
                } catch (error) {
                  console.error('Video file test failed:', error)
                }
              }}
              className="bg-pink-600 px-2 py-1 rounded text-xs"
            >
              Test Video File
            </button>
            <button
              onClick={() => {
                if (videoRef.current) {
                  console.log('Trying poster as video...')
                  videoRef.current.src = '/images/hibachi-dinner-party.jpg'
                  updateDebugInfo()
                }
              }}
              className="bg-gray-600 px-2 py-1 rounded text-xs"
            >
              Try Poster
            </button>
          </div>
        </div>
      )}

    </section>
  )
}