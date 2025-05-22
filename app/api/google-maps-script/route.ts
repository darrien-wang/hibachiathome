import { NextResponse } from "next/server"

export async function GET() {
  // Use the server-side environment variable (without NEXT_PUBLIC_)
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return new NextResponse("console.error('Google Maps API key not configured');", {
      status: 200,
      headers: {
        "Content-Type": "application/javascript",
      },
    })
  }

  // Generate a script that will load the Google Maps API
  const script = `
    (function() {
      if (window.googleMapsScriptLoaded) return;
      window.googleMapsScriptLoaded = true;
      
      const script = document.createElement('script');
      script.src = "https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places";
      script.async = true;
      script.defer = true;
      
      script.onload = function() {
        window.googleMapsLoaded = true;
      };
      
      document.head.appendChild(script);
    })();
  `

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript",
    },
  })
}
