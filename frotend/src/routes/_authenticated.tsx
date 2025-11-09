/**
 * Protected Route Layout
 * All routes under this layout require authentication
 * Use this layout by placing routes in: routes/_authenticated/...
 */

import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { requireAuth } from '@/lib/auth'
import { Spinner } from '@/components/ui/spinner'

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
