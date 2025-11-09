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

  // Handle token from URL (for OAuth redirects) - only on client
  if (handleToken && typeof window !== 'undefined' && search) {
    const token = (search as { token?: string }).token
    if (token) {
      // Store token in localStorage for API client to use
      localStorage.setItem('session_token', token)
      
      // Also set cookie as fallback
      const maxAge = 7 * 24 * 60 * 60 // 7 days
      document.cookie = `session=${token}; SameSite=Lax; Path=/; Max-Age=${maxAge}`
    }
  }

  // Check authentication
  try {
    const response = await api.auth.me()
    
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
      to: '/auth/create-account',
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
    to: '/auth/create-account',
    replace: true,
  })
}

