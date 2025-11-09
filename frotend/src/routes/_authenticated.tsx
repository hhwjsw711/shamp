/**
 * Protected Route Layout
 * All routes under this layout require authentication
 * Use this layout by placing routes in: routes/_authenticated/...
 */

import { Outlet, createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/lib/auth'

export const Route = createFileRoute('/_authenticated')({
  ssr: false, // Disable SSR for protected routes - auth checks require cookies which aren't available during SSR
  beforeLoad: async ({ search, location }) => {
    // Check authentication (will throw redirect if not authenticated)
    // handleToken: true ensures OAuth tokens from URL are processed
    await requireAuth(search, location, { handleToken: true })
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return <Outlet />
}
