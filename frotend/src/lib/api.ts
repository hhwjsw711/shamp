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
  options: RequestOptions = {}
): Promise<T> {
  if (!CONVEX_URL) {
    throw new Error(
      'Convex URL is not configured. Please set VITE_CONVEX_SITE_URL or VITE_CONVEX_URL in your .env file.\n' +
      'For HTTP routes, use: VITE_CONVEX_SITE_URL=https://<your-deployment>.convex.site'
    )
  }

  const { body, headers = {}, ...restOptions } = options

  const config: RequestInit = {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include', // Include cookies for session management
  }

  if (body) {
    config.body = JSON.stringify(body)
  }

  const fullUrl = `${CONVEX_URL}${endpoint}`
  
  // Log the URL in development for debugging
  if (import.meta.env.DEV) {
    console.log('API Request:', fullUrl)
  }

  const response = await fetch(fullUrl, config)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: response.statusText,
    }))
    // Backend returns { error: "message" } format
    const errorMessage = errorData.error || errorData.message || 'An error occurred'
    
    // Log full error details in development
    if (import.meta.env.DEV) {
      console.error('API Error:', {
        url: fullUrl,
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
      })
    }
    
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
      request<{ user: unknown; message: string }>('/api/auth/login', {
        method: 'POST',
        body: data,
      }),

    me: () =>
      request<{ user: unknown }>('/api/auth/me', {
        method: 'GET',
      }),

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

