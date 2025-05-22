"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"

// 在文件顶部添加以下类型声明：
declare global {
  interface Window {
    google: any
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
    <>
      <Script src="/api/google-maps-loader" onLoad={() => setScriptLoaded(true)} strategy="lazyOnload" />
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
    </>
  )
}

export default GooglePlacesAutocomplete
