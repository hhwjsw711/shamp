/**
 * Authentication hook
 * Provides authentication methods and state
 */

import type {
  EmailVerificationInput,
  LoginInput,
  OnboardingInput,
  PasswordResetCompleteInput,
  PasswordResetRequestInput,
  PasswordResetVerifyInput,
  RegisterInput,
} from '@/lib/validations'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'

export function useAuth() {
  // Zustand automatically subscribes to changes when destructuring
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } =
    useAuthStore()

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
      return { success: true, user: response.user, token: response.token }
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
      setLoading(true)
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
      }
      return { success: true, user: response.user }
    } catch (error) {
      console.error('getCurrentUser - Error:', error)
      setUser(null)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user',
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await api.auth.logout()
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout error:', error)
    } finally {
      // Clear localStorage token only for localhost HTTP (not ngrok/production)
      if (typeof window !== 'undefined') {
        const isNgrok = window.location.hostname.includes('ngrok.io') ||
          window.location.hostname.includes('ngrok-free.app') ||
          window.location.hostname.includes('ngrok-free.dev')
        const hasHttps = window.location.protocol === 'https:'
        const useSecureCookies = isNgrok || hasHttps
        
        // Only clear localStorage for localhost HTTP (where we used it)
        if (!useSecureCookies) {
          localStorage.removeItem('session_token')
        }
      }
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

  return {
    user,
    isAuthenticated,
    isLoading,
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

