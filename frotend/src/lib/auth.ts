/**
 * Authentication helpers for route protection
 * Use these in route beforeLoad functions
 */

import { redirect } from '@tanstack/react-router'
import { api } from '@/lib/api'

export interface AuthCheckOptions {
  /**
   * Handle token from URL (for OAuth redirects)
   * If true, will extract token from search params and store it
   */
  handleToken?: boolean
  
  /**
   * Additional checks after authentication
   * Return a redirect if the user should be redirected
   */
  additionalChecks?: (user: {
    id: string
    email: string
    name?: string
    orgName?: string
    location?: string
    profilePic?: string
    emailVerified?: boolean
    onboardingCompleted?: boolean
  }) => ReturnType<typeof redirect> | void
}

/**
 * Check if user is authenticated
 * Throws redirect if not authenticated
 * Returns user data if authenticated
 */
export async function requireAuth(
  search?: Record<string, unknown>,
  location?: { href: string },
  options: AuthCheckOptions = {}
): Promise<{
  id: string
  email: string
  name?: string
  orgName?: string
  location?: string
  profilePic?: string
  emailVerified?: boolean
  onboardingCompleted?: boolean
}> {
  const { handleToken = true, additionalChecks } = options

  // Detect if we're in SSR (no window object)
  const isSSR = typeof window === 'undefined'
  
  // Detect if we're using ngrok/production (HTTPS) - cookies work properly
  // Use location.href for SSR compatibility (works in beforeLoad)
  let isNgrok = false
  let hasHttps = false
  let fullUrl: string | null = null
  
  if (location?.href) {
    try {
      // Try to parse as full URL first
      const url = new URL(location.href)
      isNgrok = url.hostname.includes('ngrok.io') ||
        url.hostname.includes('ngrok-free.app') ||
        url.hostname.includes('ngrok-free.dev')
      hasHttps = url.protocol === 'https:'
      fullUrl = location.href
    } catch (err) {
      // location.href is a relative path (e.g., '/auth/onboarding')
      // During SSR, we can't construct full URL without request headers
      // During client-side, we can use window.location
      if (!isSSR && typeof window !== 'undefined') {
        // Client-side: construct full URL from window.location
        try {
          const url = new URL(location.href, window.location.origin)
          isNgrok = url.hostname.includes('ngrok.io') ||
            url.hostname.includes('ngrok-free.app') ||
            url.hostname.includes('ngrok-free.dev')
          hasHttps = url.protocol === 'https:'
          fullUrl = url.href
        } catch (constructErr) {
          // Failed to construct URL - will fall back to window check
        }
      }
      
      // Fallback to window check (client-side only)
      if (!isSSR && typeof window !== 'undefined' && !fullUrl) {
        isNgrok = window.location.hostname.includes('ngrok.io') ||
          window.location.hostname.includes('ngrok-free.app') ||
          window.location.hostname.includes('ngrok-free.dev')
        hasHttps = window.location.protocol === 'https:'
      }
    }
  } else if (!isSSR && typeof window !== 'undefined') {
    // Fallback to window check (client-side only)
    isNgrok = window.location.hostname.includes('ngrok.io') ||
      window.location.hostname.includes('ngrok-free.app') ||
      window.location.hostname.includes('ngrok-free.dev')
    hasHttps = window.location.protocol === 'https:'
  }
  
  const useSecureCookies = isNgrok || hasHttps

  // Extract token from URL search params (only for localhost HTTP fallback)
  let sessionToken: string | null = null
  if (handleToken && search && !useSecureCookies) {
    const token = (search as { token?: string }).token
    if (token && typeof token === 'string') {
      sessionToken = token
      
      // Store token in localStorage and cookie ONLY for localhost HTTP (fallback)
      if (typeof window !== 'undefined') {
        localStorage.setItem('session_token', token)
        
        // Also set cookie as fallback
        if (typeof document !== 'undefined') {
          const maxAge = 7 * 24 * 60 * 60 // 7 days
          document.cookie = `session=${token}; SameSite=Lax; Path=/; Max-Age=${maxAge}`
        }
      }
    }
  }

  // If no token from URL, try to get from localStorage or cookie (only for localhost HTTP)
  if (!sessionToken && typeof window !== 'undefined' && !useSecureCookies) {
    sessionToken = localStorage.getItem('session_token')
    if (!sessionToken && typeof document !== 'undefined') {
      const cookies = document.cookie.split(';').map(c => c.trim())
      const sessionCookie = cookies.find(c => c.startsWith('session='))
      if (sessionCookie) {
        sessionToken = sessionCookie.split('=')[1]
      }
    }
  }
  
  // For ngrok/production: rely solely on cookies (no localStorage/URL tokens)
  // Cookies are sent automatically with credentials: 'include'

  // Check authentication
  try {
    // Make API call with explicit token if available (ensures token is used immediately)
    // For ngrok/production: pass null to rely on cookies
    const response = await api.auth.me(useSecureCookies ? null : sessionToken)
    
    if (response.user) {
      const user = response.user as {
        id: string
        email: string
        name?: string
        orgName?: string
        location?: string
        profilePic?: string
        emailVerified?: boolean
        onboardingCompleted?: boolean
      }
      
      // Run additional checks if provided
      if (additionalChecks) {
        const redirectResult = additionalChecks(user)
        if (redirectResult) {
          throw redirectResult
        }
      }
      
      return user
    }
  } catch (error) {
    // Check if this is a redirect error (from TanStack Router)
    if (
      error &&
      typeof error === 'object' &&
      ('status' in error || 'to' in error)
    ) {
      throw error
    }
    
    // If API call failed (401 or network error), user is not authenticated
    // Redirect to login with return URL
    throw redirect({
      to: '/auth/login',
      search: location
        ? {
            redirect: location.href,
          }
        : undefined,
      replace: true,
    })
  }
  
  // Fallback: redirect to login if we get here
  throw redirect({
    to: '/auth/login',
    replace: true,
  })
}

