"use client"

import type React from "react"

import { useCallback, useEffect, useRef, useState } from "react"
import { trackEvent } from "@/lib/tracking"

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

type GooglePlaceDetails = {
  formatted_address?: string
  place_id?: string
  address_components?: Array<any>
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

  const handlePlaceSelection = useCallback(
    (place: GooglePlaceDetails | undefined) => {
      if (!place?.formatted_address) return

      setInputValue(place.formatted_address)
      onChange(place.formatted_address, place)

      if (place.place_id) {
        trackEvent("location_selected", {
          place_id: place.place_id,
          location_source: "google_places_autocomplete",
        })
      }
    },
    [onChange],
  )

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
        fields: ["address_components", "formatted_address", "geometry", "name", "place_id"],
        types: ["address"],
      }

      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, options)

      // Add listener for place selection
      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace() as GooglePlaceDetails | undefined
        handlePlaceSelection(place)
      })
    }
  }, [scriptLoaded, handlePlaceSelection])

  useEffect(() => {
    const handleMockPlaceSelect = (event: Event) => {
      const customEvent = event as CustomEvent<GooglePlaceDetails>
      handlePlaceSelection(customEvent.detail)
    }

    window.addEventListener("realhibachi:mock-place-select", handleMockPlaceSelect)
    return () => {
      window.removeEventListener("realhibachi:mock-place-select", handleMockPlaceSelect)
    }
  }, [handlePlaceSelection])

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
