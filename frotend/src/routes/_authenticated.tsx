/**
 * Protected Route Layout
 * All routes under this layout require authentication
 * Use this layout by placing routes in: routes/_authenticated/...
 */

import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import * as React from 'react'
import { useEffect } from 'react'
import { requireAuth } from '@/lib/auth'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute('/_authenticated')({
  ssr: false, // Disable SSR for protected routes - auth checks require cookies which aren't available during SSR
  beforeLoad: async ({ search, location }) => {
    // Check authentication (will throw redirect if not authenticated)
    // handleToken: true ensures OAuth tokens from URL are processed
    await requireAuth(search, location, { handleToken: true })
  },
  component: AuthenticatedLayout,
  pendingComponent: LoadingSkeleton,
})

function AuthenticatedLayout() {
  const { getCurrentUser } = useAuth()
  const hasFetchedRef = React.useRef(false)

  // Fetch user data on mount to populate the store (only once)
  useEffect(() => {
    // Always fetch on mount if we haven't fetched yet
    if (!hasFetchedRef.current && typeof window !== 'undefined') {
      hasFetchedRef.current = true
      getCurrentUser().catch((error) => {
        console.error('Failed to fetch user:', error)
        // Reset ref on error so we can retry
        hasFetchedRef.current = false
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty array - only run once on mount

  return <Outlet />
}

function LoadingSkeleton() {
  const isPending = useRouterState({ select: (s) => s.isLoading })
  
  if (!isPending) return null
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ backgroundColor: '#fafafa' }}>
      <div className="absolute inset-0 bg-black/15" />
      <div className="w-full max-w-md p-8 rounded-[22px] flex flex-col items-center justify-center gap-4 bg-background/98 backdrop-blur-md shadow-2xl border border-border/20 relative z-10 min-h-[400px]">
        <Spinner className="w-8 h-8" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
