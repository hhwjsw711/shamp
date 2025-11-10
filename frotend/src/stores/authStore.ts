/**
 * Auth Store using Zustand
 * Manages authentication state globally
 */

import { create } from 'zustand'

interface User {
  id: string
  email: string
  name?: string
  orgName?: string
  location?: string
  profilePic?: string
  emailVerified?: boolean
  onboardingCompleted?: boolean
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => {
    console.log('authStore.setUser called with:', user)
    set({
      user,
      isAuthenticated: !!user,
    })
    console.log('authStore.setUser - Store updated')
  },
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
    }),
}))

