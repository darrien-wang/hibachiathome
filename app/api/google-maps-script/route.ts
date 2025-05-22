import { NextResponse } from "next/server"

export async function GET() {
  // Use the server-side environment variable (without NEXT_PUBLIC_)
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return new NextResponse("Google Maps API key not configured", { status: 500 })
  }

  // Generate a script that will load the Google Maps API
  const script = `
    (function() {
      if (window.googleMapsScriptLoaded) return;
      window.googleMapsScriptLoaded = true;
      
      const script = document.createElement('script');
      script.src = "https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsCallback";
      script.async = true;
      script.defer = true;
      
      // Create a global callback that will resolve the promise
      window.initGoogleMapsCallback = function() {
        window.googleMapsLoaded = true;
        const event = new Event('google-maps-loaded');
        window.dispatchEvent(event);
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
