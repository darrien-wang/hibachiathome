"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"

// 在文件顶部添加以下类型声明：
declare global {
  interface Window {
    google: any
    googleMapsScriptLoaded: boolean
    googleMapsLoaded: boolean
    initGoogleMapsCallback: () => void
  }
}

// 修改接口中的类型引用：
interface GooglePlacesAutocompleteProps {
  value: string
  onChange: (value: string, placeDetails?: any) => void
  placeholder?: string
  className?: string
  required?: boolean
}

const GooglePlacesAutocomplete: React.FC<GooglePlacesAutocompleteProps> = ({
  value,
  onChange,
  placeholder,
  className,
  required,
}) => {
  const inputRef = useRef<any>(null)
  const autocompleteRef = useRef<any>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [inputValue, setInputValue] = useState(value)

  // Load Google Maps script
  useEffect(() => {
    // Check if script is already loaded
    if (window.google?.maps?.places) {
      setScriptLoaded(true)
      return
    }

    // Create a function to handle script loading
    const loadGoogleMapsScript = async () => {
      try {
        // Fetch the script content from our API
        const response = await fetch("/api/google-maps-script")
        if (!response.ok) throw new Error("Failed to load Google Maps script")

        const scriptContent = await response.text()

        // Execute the script content
        const scriptElement = document.createElement("script")
        scriptElement.type = "text/javascript"
        scriptElement.text = scriptContent
        document.head.appendChild(scriptElement)

        // Set up a listener for when Google Maps is fully loaded
        const checkGoogleMapsLoaded = setInterval(() => {
          if (window.google?.maps?.places) {
            clearInterval(checkGoogleMapsLoaded)
            setScriptLoaded(true)
          }
        }, 100)

        // Clear interval after 10 seconds to prevent infinite checking
        setTimeout(() => clearInterval(checkGoogleMapsLoaded), 10000)
      } catch (error) {
        console.error("Error loading Google Maps:", error)
      }
    }

    loadGoogleMapsScript()

    // No need for event listener cleanup since we're using intervals with timeouts
  }, [])

  // Initialize autocomplete when script is loaded and input is available
  useEffect(() => {
    if (scriptLoaded && inputRef.current && !autocompleteRef.current && window.google?.maps?.places) {
      const options = {
        componentRestrictions: { country: "us" },
        fields: ["address_components", "formatted_address", "geometry", "name"],
        types: ["address"],
      }

      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, options)

      // Add listener for place selection
      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace()
        if (place?.formatted_address) {
          setInputValue(place.formatted_address)
          onChange(place.formatted_address, place) // 传递完整的地点详情
        }
      })
    }
  }, [scriptLoaded, onChange])

  // Update local input value when prop value changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Handle manual input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    // Only update parent state when user is typing manually
    // (not when selecting from dropdown, which is handled by place_changed event)
    if (e.target.value !== value) {
      onChange(e.target.value)
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={inputValue}
      onChange={handleInputChange}
      placeholder={placeholder}
      className={`w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white ${className}`}
      required={required}
      autoComplete="street-address"
    />
  )
}

export default GooglePlacesAutocomplete
