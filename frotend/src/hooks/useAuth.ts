/**
 * Authentication hook
 * Provides authentication methods and state
 */

import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import type {
  RegisterInput,
  LoginInput,
  EmailVerificationInput,
  PasswordResetRequestInput,
  PasswordResetVerifyInput,
  PasswordResetCompleteInput,
  OnboardingInput,
} from '@/lib/validations'

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } =
    useAuthStore()

  const register = async (data: RegisterInput) => {
    try {
      setLoading(true)
      await api.auth.register(data)
      // After registration, send verification code
      await api.emailVerification.sendCode({ email: data.email })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (data: LoginInput) => {
    try {
      setLoading(true)
      const response = await api.auth.login(data)
      if (response.user) {
        setUser(response.user as typeof user)
      }
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
      setLoading(true)
      const response = await api.auth.me()
      if (response.user) {
        setUser(response.user as typeof user)
      }
      return { success: true, user: response.user }
    } catch (error) {
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
      await api.emailVerification.verifyCode(data)
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

  const verifyPasswordResetCode = async (data: PasswordResetVerifyInput) => {
    try {
      await api.passwordReset.verify(data)
      return { success: true }
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
        email: data.email,
        code: data.code,
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

