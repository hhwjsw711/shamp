/**
 * Hook to load Google Maps JavaScript API with Places library
 * Ensures the script is loaded only once and provides loading state
 */

import { useEffect, useState } from 'react'

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-script'

// Type-safe helper to check if Google Maps is loaded
const getGoogleMaps = (): boolean => {
  // Use type assertion to access window.google safely
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any
  return !!win.google?.maps?.places
}

export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  useEffect(() => {
    // Check if script is already loaded
    if (getGoogleMaps()) {
      setIsLoaded(true)
      return
    }

    // Check if script is already being loaded
    if (document.getElementById(GOOGLE_MAPS_SCRIPT_ID)) {
      // Script exists but not loaded yet, wait for it
      const checkLoaded = setInterval(() => {
        if (getGoogleMaps()) {
          setIsLoaded(true)
          clearInterval(checkLoaded)
        }
      }, 100)

      return () => clearInterval(checkLoaded)
    }

    // If no API key, set error and return
    if (!GOOGLE_MAPS_API_KEY) {
      setLoadError(
        new Error(
          'Google Maps API key is not configured. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file.'
        )
      )
      return
    }

    // Create script element
    const script = document.createElement('script')
    script.id = GOOGLE_MAPS_SCRIPT_ID
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`
    script.async = true
    script.defer = true

    script.onload = () => {
      setIsLoaded(true)
      setLoadError(null)
    }

    script.onerror = () => {
      setLoadError(
        new Error('Failed to load Google Maps JavaScript API')
      )
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup: remove script if component unmounts before loading
      const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID)
      if (existingScript && !getGoogleMaps()) {
        existingScript.remove()
      }
    }
  }, [])

  return { isLoaded, loadError }
}

