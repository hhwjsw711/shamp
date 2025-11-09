/**
 * API Client for Convex Backend
 * Handles all HTTP requests to the backend endpoints
 */

// Get Convex HTTP routes URL from environment variable
// For Convex HTTP routes, use: https://<deployment-name>.convex.site
// VITE_CONVEX_URL is for API (queries/mutations) - uses .convex.cloud
// VITE_CONVEX_SITE_URL is for HTTP routes - uses .convex.site
const CONVEX_URL =
  import.meta.env.VITE_CONVEX_SITE_URL || 
  import.meta.env.VITE_CONVEX_URL?.replace('.convex.cloud', '.convex.site') ||
  (() => {
    console.error(
      'Missing VITE_CONVEX_SITE_URL or VITE_CONVEX_URL environment variable.\n' +
      'Set VITE_CONVEX_SITE_URL=https://<your-deployment>.convex.site in your .env file.\n' +
      'You can find your deployment URL by running: npx convex dev'
    )
    return ''
  })()

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
  providedToken?: string | null
): Promise<T> {
  if (!CONVEX_URL) {
    throw new Error(
      'Convex URL is not configured. Please set VITE_CONVEX_SITE_URL or VITE_CONVEX_URL in your .env file.\n' +
      'For HTTP routes, use: VITE_CONVEX_SITE_URL=https://<your-deployment>.convex.site'
    )
  }

  const { body, headers = {}, ...restOptions } = options

  // Detect if we're using ngrok/production (HTTPS) - cookies work properly
  const isNgrok = typeof window !== 'undefined' && (
    window.location.hostname.includes('ngrok.io') ||
    window.location.hostname.includes('ngrok-free.app') ||
    window.location.hostname.includes('ngrok-free.dev')
  )
  const hasHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const useSecureCookies = isNgrok || hasHttps

  // Extract token from provided token, localStorage, or cookie
  // For ngrok/production: rely solely on cookies (no localStorage/URL tokens)
  // For localhost HTTP: use localStorage/cookie as fallback
  // IMPORTANT: If providedToken is explicitly null, don't try to extract from localStorage/cookie
  // This means the caller wants to rely solely on cookies
  let sessionToken: string | null = providedToken || null
  
  if (providedToken === null) {
    // Explicitly null means "use cookies only, don't try localStorage/cookie extraction"
    sessionToken = null
  } else if (!sessionToken && typeof window !== 'undefined' && !useSecureCookies) {
    // Only try localStorage/cookie extraction if:
    // 1. No token was provided
    // 2. We're on client-side
    // 3. We're NOT using secure cookies (localhost HTTP fallback)
    // Try localStorage first (set from URL token) - only for localhost HTTP
    sessionToken = localStorage.getItem('session_token')
    
    // Fallback to cookie if no localStorage token
    if (!sessionToken && typeof document !== 'undefined') {
      const cookies = document.cookie.split(';').map(c => c.trim())
      const sessionCookie = cookies.find(c => c.startsWith('session='))
      if (sessionCookie) {
        sessionToken = sessionCookie.split('=')[1]
      }
    }
  }
  
  // For ngrok/production: cookies are sent automatically with credentials: 'include'
  // No need to extract token - backend reads from cookie header

  const config: RequestInit = {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      // For localhost: always use Authorization header if we have a token
      // This bypasses cross-domain cookie issues
      // For ngrok/production: don't add Authorization header, rely on cookies
      ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
      ...headers,
    },
    credentials: 'include', // Include cookies for session management
  }

  if (body) {
    config.body = JSON.stringify(body)
  }

  const fullUrl = `${CONVEX_URL}${endpoint}`

  const response = await fetch(fullUrl, config)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: response.statusText,
    }))
    // Backend returns { error: "message" } format
    const errorMessage = errorData.error || errorData.message || 'An error occurred'
    
    throw new Error(errorMessage)
  }

  return response.json()
}

export const api = {
  // Auth endpoints
  auth: {
    register: (data: { email: string; password: string }) =>
      request<{
        success: boolean
        message: string
        user?: {
          id: string
          email: string
          emailVerified?: boolean
          onboardingCompleted?: boolean
        }
      }>('/api/auth/register', {
        method: 'POST',
        body: data,
      }),

    login: (data: { email: string; password: string }) =>
      request<{
        user: {
          id: string
          email: string
          name?: string
          orgName?: string
          location?: string
          emailVerified?: boolean
          onboardingCompleted?: boolean
        }
        message?: string
        token?: string // For localhost fallback
      }>('/api/auth/login', {
        method: 'POST',
        body: data,
      }),

    me: (token?: string | null) =>
      request<{ user: unknown }>('/api/auth/me', {
        method: 'GET',
      }, token),

    logout: () =>
      request<{ message: string }>('/api/auth/logout', {
        method: 'POST',
      }),

    getGoogleAuthUrl: () =>
      request<{ url: string }>('/api/auth/google/url', {
        method: 'GET',
      }),
  },

  // Email verification endpoints
  emailVerification: {
    sendCode: (data: { email: string }) =>
      request<{ message: string }>(
        '/api/auth/email-verification/send-code',
        {
          method: 'POST',
          body: data,
        }
      ),

    verifyCode: (data: { code: string }) =>
      request<{ message: string }>(
        '/api/auth/email-verification/verify-code',
        {
          method: 'POST',
          body: { code: data.code },
        }
      ),
  },

  // Password reset endpoints
  passwordReset: {
    request: (data: { email: string }) =>
      request<{ message: string }>('/api/auth/password-reset/request', {
        method: 'POST',
        body: data,
      }),

    verify: (data: { email: string; code: string }) =>
      request<{ message: string }>('/api/auth/password-reset/verify', {
        method: 'POST',
        body: data,
      }),

    complete: (data: {
      email: string
      code: string
      newPassword: string
    }) =>
      request<{ message: string }>('/api/auth/password-reset/complete', {
        method: 'POST',
        body: data,
      }),
  },

  // Onboarding endpoint
  onboarding: (data: {
    name: string
    orgName: string
    location: string
  }) =>
    request<{ message: string; pin?: string }>('/api/auth/onboarding', {
      method: 'POST',
      body: data,
    }),
}


