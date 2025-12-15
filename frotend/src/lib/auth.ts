/**
 * Authentication helpers for route protection
 * Use these in route beforeLoad functions
 */

import { redirect } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

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
  _search?: Record<string, unknown>,
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
  const { additionalChecks } = options

  // Check authentication
  try {
    // Best practice: rely on HttpOnly session cookies only (no JS-accessible token storage)
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
      
      // Populate auth store immediately when auth is validated
      // IMPORTANT: Keep isLoading true - it will be set to false when Convex query completes
      // This ensures skeletons show until all data is ready
      if (typeof window !== 'undefined') {
        const store = useAuthStore.getState()
        store.setUser(user)
        // Don't set isLoading to false here - let Convex query completion handle it
        // This ensures components show skeletons until Convex query syncs
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

