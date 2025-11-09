/**
 * Type declarations for Google Maps JavaScript API
 * Extends the Window interface to include google.maps types
 */

interface Window {
  google?: {
    maps?: {
      places?: {
        AutocompleteService?: new () => {
          getPlacePredictions: (
            request: {
              input: string
              types?: string[]
              componentRestrictions?: { country?: string | string[] }
            },
            callback: (
              predictions: google.maps.places.AutocompletePrediction[] | null,
              status: google.maps.places.PlacesServiceStatus
            ) => void
          ) => void
        }
        PlacesServiceStatus?: {
          OK: string
          ZERO_RESULTS: string
          OVER_QUERY_LIMIT: string
          REQUEST_DENIED: string
          INVALID_REQUEST: string
        }
      }
    }
  }
}

// Minimal type definitions for Google Maps Places API
declare namespace google.maps.places {
  interface AutocompletePrediction {
    description: string
    place_id: string
    structured_formatting: {
      main_text: string
      secondary_text: string
    }
  }

  enum PlacesServiceStatus {
    OK = 'OK',
    ZERO_RESULTS = 'ZERO_RESULTS',
    OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
    REQUEST_DENIED = 'REQUEST_DENIED',
    INVALID_REQUEST = 'INVALID_REQUEST',
  }
}

