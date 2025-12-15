/**
 * Authentication hook
 * Provides authentication methods and state
 */

import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import type {
  EmailVerificationInput,
  LoginInput,
  OnboardingInput,
  PasswordResetCompleteInput,
  PasswordResetRequestInput,
  RegisterInput,
} from '@/lib/validations'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { api as convexApi } from '@/lib/convex-api'

export function useAuth() {
  // Zustand automatically subscribes to changes when destructuring
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } =
    useAuthStore()

  // Use Convex query for real-time user data updates
  // Only query if we have a userId (from initial auth check)
  const userDataResult = useQuery(
    convexApi.functions.auth.queries.getCurrentUser,
    user?.id
      ? { userId: user.id as any } // Type assertion - backend validates userId
      : 'skip' // Skip query if no userId
  )

  // Track if Convex query is loading
  // If we have user.id, check if Convex query is still loading
  // If we don't have user.id yet, we're still waiting for getCurrentUser() to complete
  const isConvexQueryLoading = user?.id ? userDataResult === undefined : false

  // Sync Convex query result to Zustand store for real-time updates
  useEffect(() => {
    if (userDataResult !== undefined && user?.id) {
      // userDataResult is undefined while loading, null on error, or user data
      if (userDataResult === null) {
        // Query error - user might have been deleted or unauthorized
        // Don't clear user immediately, might be temporary error
        console.warn('Failed to fetch user data from Convex query')
        // Set loading to false even on error so UI doesn't hang
        setLoading(false)
      } else if (userDataResult) {
        // Update store with fresh data from Convex (real-time updates)
        const userData = {
          id: userDataResult._id,
          email: userDataResult.email,
          name: userDataResult.name,
          orgName: userDataResult.orgName,
          location: userDataResult.location,
          profilePic: userDataResult.profilePic,
          emailVerified: userDataResult.emailVerified,
          onboardingCompleted: userDataResult.onboardingCompleted,
        }
        setUser(userData)
        // Set loading to false ONLY when Convex query completes successfully
        // This ensures skeletons show until all data is synced
        setLoading(false)
      }
    }
  }, [userDataResult, user?.id, setUser, setLoading])

  // IMPORTANT: Keep isLoading true until we actually have user data
  // This prevents blank screens when getCurrentUser() completes but user is still null
  // or when Convex query hasn't synced yet
  const hasUserData = !!user

  const register = async (data: RegisterInput) => {
    try {
      setLoading(true)
      const response = await api.auth.register(data)
      // Registration already sends verification code on the backend
      // No need to call sendCode separately
      return { success: true, message: response.message }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Account creation failed',
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (data: LoginInput) => {
    try {
      setLoading(true)
      const response = await api.auth.login(data)
      setUser(response.user as typeof user)
      return { success: true, user: response.user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }
    } finally {
      setLoading(false)
    }
  }

  const getCurrentUser = async () => {
    try {
      // Only set loading if user doesn't exist yet (requireAuth might have already set it)
      if (!user) {
        setLoading(true)
      }
      const response = await api.auth.me()
      console.log('getCurrentUser - API response:', response)
      if (response.user) {
        // Properly type the user data
        const userData = response.user as {
          id: string
          email: string
          name?: string
          orgName?: string
          location?: string
          profilePic?: string
          emailVerified?: boolean
          onboardingCompleted?: boolean
        }
        console.log('getCurrentUser - Setting user data:', userData)
        setUser(userData)
        console.log('getCurrentUser - User set in store')
        // Don't set loading to false here - let Convex query completion handle it
        // This ensures loading stays true until Convex syncs
      } else {
        // No user data - set loading to false
        setLoading(false)
      }
      return { success: true, user: response.user }
    } catch (error) {
      console.error('getCurrentUser - Error:', error)
      setUser(null)
      setLoading(false)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user',
      }
    }
  }

  const handleLogout = async () => {
    try {
      await api.auth.logout()
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout error:', error)
    } finally {
      logout()
    }
  }

  const sendVerificationCode = async (data: { email: string }) => {
    try {
      await api.emailVerification.sendCode(data)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send verification code',
      }
    }
  }

  const verifyEmail = async (data: EmailVerificationInput) => {
    try {
      await api.emailVerification.verifyCode({ code: data.code })
      // Refresh user data after verification
      await getCurrentUser()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Email verification failed',
      }
    }
  }

  const requestPasswordReset = async (data: PasswordResetRequestInput) => {
    try {
      await api.passwordReset.request(data)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to request password reset',
      }
    }
  }

  const verifyPasswordResetCode = async (data: { code: string }) => {
    try {
      const response = await api.passwordReset.verify({ code: data.code })
      return { success: true, userId: response.userId }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to verify reset code',
      }
    }
  }

  const completePasswordReset = async (
    data: PasswordResetCompleteInput
  ) => {
    try {
      await api.passwordReset.complete({
        userId: data.userId,
        newPassword: data.newPassword,
      })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to reset password',
      }
    }
  }

  const completeOnboarding = async (data: OnboardingInput) => {
    try {
      const response = await api.onboarding(data)
      // Refresh user data after onboarding
      await getCurrentUser()
      return { success: true, pin: response.pin }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Onboarding failed',
      }
    }
  }

  const getGoogleAuthUrl = async () => {
    try {
      const response = await api.auth.getGoogleAuthUrl()
      return { success: true, url: response.url }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get Google auth URL',
      }
    }
  }

  // Combined loading state: 
  // 1. Auth store loading (getCurrentUser in progress)
  // 2. OR Convex query loading (when user.id exists)
  // 3. OR we don't have user data yet AND store isLoading is false
  //    (This handles the gap: requireAuth validated auth, but getCurrentUser hasn't populated store yet)
  //    We check !isLoading to avoid double-counting when isLoading is already true
  // This ensures we show loading until we actually have user data, preventing blank screens
  const combinedIsLoading = isLoading || isConvexQueryLoading || (!isLoading && !hasUserData)

  return {
    user,
    isAuthenticated,
    isLoading: combinedIsLoading,
    register,
    login,
    logout: handleLogout,
    getCurrentUser,
    sendVerificationCode,
    verifyEmail,
    requestPasswordReset,
    verifyPasswordResetCode,
    completePasswordReset,
    completeOnboarding,
    getGoogleAuthUrl,
  }
}

