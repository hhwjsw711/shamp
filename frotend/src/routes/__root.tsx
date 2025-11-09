import { HeadContent, Scripts, createRootRoute, useLocation } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { AnimatePresence } from 'motion/react'

import appCss from '../styles.css?url'
import { Toaster } from '@/components/ui/sonner'

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
  
  return (
    <html lang="en" style={{ fontFamily: 'Manrope, sans-serif' }}>
      <head>
        <HeadContent />
      </head>
      <body>
        <AnimatePresence mode="wait">
          <div key={location.pathname}>
            {children}
          </div>
        </AnimatePresence>
        <Toaster />
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
  )
}
