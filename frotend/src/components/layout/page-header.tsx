import * as React from 'react'
import { Link, useLocation, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { PageHeaderCTAsContainer } from './page-header-ctas'
import { LanguageSwitcher } from './language-switcher'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { api as convexApi } from '@/lib/convex-api'
import { useAuth } from '@/hooks/useAuth'

export function PageHeader() {
  const location = useLocation()
  const params = useParams({ strict: false })
  const { user, isAuthenticated } = useAuth()
  const { t } = useTranslation()

  const menuItems = [
    {
      title: t($ => $.breadcrumb.home),
      href: '/',
    },
    {
      title: t($ => $.breadcrumb.createTicket),
      href: '/tickets/create',
    },
    {
      title: t($ => $.breadcrumb.tickets),
      href: '/tickets',
    },
    {
      title: t($ => $.breadcrumb.editTicket),
      href: '/tickets/$ticketId/edit',
    },
    {
      title: t($ => $.breadcrumb.vendors),
      href: '/vendors',
    },
    {
      title: t($ => $.breadcrumb.conversations),
      href: '/conversations',
    },
  ]

  // Check if we're on the edit ticket page or ticket details page
  const isEditTicketPage = location.pathname.match(/^\/tickets\/[^/]+\/edit$/)
  const isTicketDetailsPage = location.pathname.match(/^\/tickets\/[^/]+$/) && !isEditTicketPage

  // Get ticket data for edit page or details page breadcrumb
  const ticketResult = useQuery(
    convexApi.functions.tickets.queries.getById,
    (isEditTicketPage || isTicketDetailsPage) && user?.id && isAuthenticated && params.ticketId
      ? { ticketId: params.ticketId as any, userId: user.id as any }
      : 'skip'
  )

  const ticketName = ticketResult?.ticketName || t($ => $.breadcrumb.ticket)

  // Generate breadcrumb items based on pathname
  const pathSegments = location.pathname.split('/').filter(Boolean)

  // Special case: Tickets page should only show "Tickets", not "Home > Tickets"
  const isTicketsPage = location.pathname === '/tickets'

  // Special case: Edit ticket page - start from "Tickets", not "Home"
  // Breadcrumb should be: Tickets > Ticket > Edit
  // Special case: Ticket details page - start from "Tickets", not "Home"
  // Breadcrumb should be: Tickets > Ticket Name
  const breadcrumbItems = isTicketsPage
    ? [{ label: t($ => $.breadcrumb.tickets), href: '/tickets' }]
    : isEditTicketPage || isTicketDetailsPage
    ? [
        { label: t($ => $.breadcrumb.tickets), href: '/tickets' },
        ...pathSegments.slice(1).map((segment, index) => {
          const segmentIndex = index + 1 // Adjust index since we're slicing from index 1
          const href = '/' + pathSegments.slice(0, segmentIndex + 1).join('/')
          const menuItem = menuItems.find((item) => item.href === href)

          // Replace ticketId segment with ticketName for edit/details page
          // The ticketId is at segmentIndex 1 (after 'tickets')
          let label = menuItem?.title || segment.charAt(0).toUpperCase() + segment.slice(1)
          if (segmentIndex === 1 && !menuItem) {
            // If it's the edit/details page and this segment doesn't match a menu item, it's likely the ticketId
            // Use ticketName if available, otherwise fall back to "Ticket"
            label = ticketName
          }

          return {
            label,
            href,
          }
        }),
      ]
    : [
        { label: t($ => $.breadcrumb.home), href: '/' },
        ...pathSegments.map((segment, index) => {
          const href = '/' + pathSegments.slice(0, index + 1).join('/')
          const menuItem = menuItems.find((item) => item.href === href)

          const label = menuItem?.title || segment.charAt(0).toUpperCase() + segment.slice(1)

          return {
            label,
            href,
          }
        }),
      ]

  return (
    <header className="bg-zinc-100 rounded-[22px] px-4 py-2">
      <section className="flex flex-row gap-2 items-center justify-between w-full">
        {/* Left section: SidebarTrigger and breadcrumb */}
        <section className="flex flex-row gap-2 items-center flex-1 min-w-0">
          {/* SidebarTrigger */}
          <section className="flex items-center md:hidden">
            <SidebarTrigger />
          </section>

          {/* Breadcrumb */}
          <section className="flex flex-col gap-1 flex-1 min-w-0">
            <Breadcrumb>
              <BreadcrumbList className="gap-2">
                {breadcrumbItems.map((item, index) => {
                  const isLast = index === breadcrumbItems.length - 1
                  return (
                    <React.Fragment key={item.href}>
                      {index > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage>{item.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={item.href}>{item.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </section>
        </section>

        {/* Right section: Language Switcher and CTAs */}
        <section className="flex items-center gap-2 shrink-0">
          <LanguageSwitcher />
          <PageHeaderCTAsContainer />
        </section>
      </section>
    </header>
  )
}

