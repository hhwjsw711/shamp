import * as React from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

const menuItems = [
  {
    title: 'Home',
    href: '/',
  },
  {
    title: 'Create New Ticket',
    href: '/tickets/create',
  },
  {
    title: 'Tickets',
    href: '/tickets',
  },
  {
    title: 'Edit Ticket',
    href: '/tickets/$ticketId/edit',
  },
  {
    title: 'Vendors',
    href: '/vendors',
  },
  {
    title: 'Conversations',
    href: '/conversations',
  },
]

export function PageHeader() {
  const location = useLocation()

  // Check if we're on the edit ticket page
  const isEditTicketPage = location.pathname.match(/^\/tickets\/[^/]+\/edit$/)

  // Find the active page name - check exact matches first, then prefix matches
  const activePage = menuItems.find(
    (item) => location.pathname === item.href
  ) || (isEditTicketPage 
    ? menuItems.find((item) => item.href === '/tickets/$ticketId/edit')
    : menuItems.find(
        (item) => item.href !== '/' && location.pathname.startsWith(item.href)
      )
  )

  const pageName = activePage?.title || 'Home'

  // Generate breadcrumb items based on pathname
  const pathSegments = location.pathname.split('/').filter(Boolean)
  
  // Special case: Tickets page should only show "Tickets", not "Home > Tickets"
  const isTicketsPage = location.pathname === '/tickets'
  
  const breadcrumbItems = isTicketsPage
    ? [{ label: 'Tickets', href: '/tickets' }]
    : [
        { label: 'Home', href: '/' },
        ...pathSegments.map((segment, index) => {
          const href = '/' + pathSegments.slice(0, index + 1).join('/')
          const menuItem = menuItems.find((item) => item.href === href)
          
          // Replace ticketId segment with "Ticket" for edit page
          // The ticketId is at index 1 (after 'tickets')
          let label = menuItem?.title || segment.charAt(0).toUpperCase() + segment.slice(1)
          if (isEditTicketPage && index === 1 && !menuItem) {
            // If it's the edit page and this segment doesn't match a menu item, it's likely the ticketId
            label = 'Ticket'
          }
          
          return {
            label,
            href,
          }
        }),
      ]

  return (
    <header className="bg-zinc-100 rounded-[22px] px-4 py-2">
      <section className="flex flex-row gap-2 items-center justify-start w-full">
        {/* First section: SidebarTrigger */}
        <section className="flex items-center md:hidden">
          <SidebarTrigger />
        </section>

        {/* Second section: Page name and breadcrumb */}
        <section className="flex flex-col gap-1 flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-foreground truncate">
            {pageName}
          </h1>
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
    </header>
  )
}

