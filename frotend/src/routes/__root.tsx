import { HeadContent, Link, Scripts, createRootRoute, useLocation } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { AnimatePresence } from 'motion/react'
import { ConvexProvider } from 'convex/react'
import { useTranslation } from 'react-i18next'

import appCss from '../styles.css?url'
import { Toaster } from '@/components/ui/sonner'
import { AppSidebar } from '@/components/layout/sidebar'
import { PageHeader } from '@/components/layout/page-header'
import { PageHeaderCTAsProvider } from '@/components/layout/page-header-ctas'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { convex } from '@/lib/convex'

// Initialize i18n
import '@/i18n'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <h1 className="text-4xl font-bold text-gray-900">{t($ => $.notFound.title)}</h1>
      <p className="text-gray-600">{t($ => $.notFound.description)}</p>
      <Button asChild>
        <Link to="/">{t($ => $.notFound.backToHome)}</Link>
      </Button>
    </div>
  )
}

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

  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  // Show sidebar for authenticated routes (not auth pages)
  const isAuthenticatedRoute = !location.pathname.startsWith('/auth')

  // Get current language from i18next
  const currentLanguage = typeof window !== 'undefined'
    ? window.localStorage.getItem('i18nextLng') || 'en'
    : 'en'

  return (
    <ConvexProvider client={convex}>
      <PageHeaderCTAsProvider>
        <html lang={currentLanguage} style={{ fontFamily: 'Manrope, sans-serif' }}>
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
