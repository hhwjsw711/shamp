/**
 * API Client for Convex Backend
 * Handles all HTTP requests to the backend endpoints
 */

const CONVEX_URL =
  import.meta.env.VITE_CONVEX_URL || 'https://your-convex-deployment.convex.cloud'

interface RequestOptions extends RequestInit {
  body?: unknown
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
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

  const response = await fetch(`${CONVEX_URL}${endpoint}`, config)

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }))
    throw new Error(error.message || 'An error occurred')
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

    verifyCode: (data: { email: string; code: string }) =>
      request<{ message: string }>(
        '/api/auth/email-verification/verify-code',
        {
          method: 'POST',
          body: data,
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

