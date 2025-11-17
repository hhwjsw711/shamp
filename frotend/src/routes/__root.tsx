import { HeadContent, Scripts, createRootRoute, useLocation } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { AnimatePresence } from 'motion/react'
import { ConvexProvider } from 'convex/react'

import appCss from '../styles.css?url'
import { Toaster } from '@/components/ui/sonner'
import { AppSidebar } from '@/components/layout/sidebar'
import { PageHeader } from '@/components/layout/page-header'
import { PageHeaderCTAsProvider } from '@/components/layout/page-header-ctas'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { convex } from '@/lib/convex'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Shamp - AI Agents for Hospitality Maintenance',
      },
      {
        name: 'description',
        content:
          'Automate your hospitality maintenance with AI-powered workflows. Shamp intelligently discovers vendors, manages repairs, and resolves issues faster—so you can focus on what matters.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap',
      },
      {
        rel: 'icon',
        type: 'image/png',
        href: '/shamp-favicon.png',
      },
    ],
    scripts: GOOGLE_MAPS_API_KEY
      ? [
          {
            src: `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`,
            async: true,
            defer: true,
          },
        ]
      : [],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  // Show sidebar for authenticated routes (not auth pages)
  const isAuthenticatedRoute = !location.pathname.startsWith('/auth')
  
  return (
    <ConvexProvider client={convex}>
      <PageHeaderCTAsProvider>
        <html lang="en" style={{ fontFamily: 'Manrope, sans-serif' }}>
          <head>
            <HeadContent />
          </head>
          <body style={{ backgroundColor: '#fafafa', margin: 0 }}>
            <AnimatePresence mode="wait">
              <main key={location.pathname} className="flex flex-row h-screen gap-0 overflow-hidden">
                {isAuthenticatedRoute ? (
                  <SidebarProvider>
                    <AppSidebar />
                    <SidebarInset className="flex-1 flex flex-col gap-2 p-4 overflow-hidden">
                      <section className="md:hidden">
                        <PageHeader />
                      </section>
                      <section className="bg-zinc-100 rounded-[22px] overflow-hidden flex-1 min-h-0 flex flex-col gap-2">
                        <section className="hidden md:block">
                          <PageHeader />
                        </section>
                        {children}
                      </section>
                    </SidebarInset>
                  </SidebarProvider>
                ) : (
                  <section className="flex-1">
                    {children}
                  </section>
                )}
              </main>
            </AnimatePresence>
          <Toaster position="top-center" />
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
            <Scripts />
          </body>
        </html>
      </PageHeaderCTAsProvider>
    </ConvexProvider>
  )
}
