import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { TicketStatusColumn } from '@/components/layout/ticket-status-column'
import { TicketCard } from '@/components/layout/ticket-card'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/convex-api'

export const Route = createFileRoute('/_authenticated/tickets/')({
  component: TicketsPage,
})

type TicketStatus =
  | 'analyzing'
  | 'analyzed'
  | 'reviewed'
  | 'find_vendors'
  | 'requested_for_information'
  | 'quotes_available'
  | 'quote_selected'
  | 'fixed'
  | 'closed'

type Ticket = {
  _id: string
  createdBy: string
  name?: string
  ticketName?: string
  description: string
  location?: string
  status: TicketStatus
  urgency?: 'emergency' | 'urgent' | 'normal' | 'low'
  issueType?: string
  predictedTags?: Array<string>
  problemDescription?: string
  photoIds: Array<string>
  photoUrls?: Array<string | null>
  createdAt: number
  updatedAt?: number
}

// Only show these statuses in the UI (analyzing is transient, not shown)
// Hook to get status labels with translations
function useTicketStatuses() {
  const { t } = useTranslation()

  return [
    { value: 'analyzed' as const, label: t($ => $.tickets.status.analyzed) },
    { value: 'reviewed' as const, label: t($ => $.tickets.status.reviewed) },
    { value: 'find_vendors' as const, label: t($ => $.tickets.status.findVendors) },
    { value: 'requested_for_information' as const, label: t($ => $.tickets.status.requestedForInformation) },
    { value: 'quotes_available' as const, label: t($ => $.tickets.status.quotesAvailable) },
    { value: 'quote_selected' as const, label: t($ => $.tickets.status.quoteSelected) },
    { value: 'fixed' as const, label: t($ => $.tickets.status.fixed) },
    { value: 'closed' as const, label: t($ => $.tickets.status.closed) },
  ]
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function TicketsPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const TICKET_STATUSES = useTicketStatuses()
  const [isMobile, setIsMobile] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | 'all'>('all')
  
  // Search and sort state per status (only for statuses shown in UI)
  const [searchQueries, setSearchQueries] = useState<Record<TicketStatus, string>>({
    analyzing: '',
    analyzed: '',
    reviewed: '',
    find_vendors: '',
    requested_for_information: '',
    quotes_available: '',
    quote_selected: '',
    fixed: '',
    closed: '',
  })
  
  const [sortBy, setSortBy] = useState<Record<TicketStatus, 'date' | 'urgency'>>({
    analyzing: 'date',
    analyzed: 'date',
    reviewed: 'date',
    find_vendors: 'date',
    requested_for_information: 'date',
    quotes_available: 'date',
    quote_selected: 'date',
    fixed: 'date',
    closed: 'date',
  })

  // Use Convex mutation for deleting tickets
  const deleteTicket = useMutation(api.functions.tickets.mutations.deleteTicket)

  // Use Convex query for real-time ticket updates
  // Only query if user is authenticated and has an ID
  // SECURITY: userId is validated on the backend - users can only see their own tickets
  // The backend query validates userId exists and filters by createdBy
  const ticketsResult = useQuery(
    api.functions.tickets.queries.list,
    user?.id && isAuthenticated
      ? { userId: user.id as any } // Type assertion - backend validates userId
      : 'skip' // Skip query if not authenticated
  )

  // Handle loading and error states
  // useQuery returns undefined while loading, array when loaded
  const isLoading = ticketsResult === undefined && isAuthenticated
  const tickets = ticketsResult as Array<Ticket> | undefined
  // Use empty array if tickets is undefined or null - allows columns to render with empty states
  const ticketsArray = tickets || []

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Reset selectedStatus to 'all' when switching from mobile to desktop
  useEffect(() => {
    if (!isMobile && selectedStatus !== 'all') {
      setSelectedStatus('all')
    }
  }, [isMobile, selectedStatus])

  // Set initial selected status to highest count on mobile only
  useEffect(() => {
    // Only run on mobile, when tickets are loaded, and selectedStatus is still 'all'
    if (!ticketsArray || ticketsArray.length === 0 || !isMobile || selectedStatus !== 'all') return
    
    // Calculate raw counts for each status (without search/sort filters)
    const statusCounts = TICKET_STATUSES.map((status) => ({
      status: status.value,
      count: ticketsArray.filter((ticket) => ticket.status === status.value).length,
    }))
    
    // Find status with highest count
    const highestCountStatus = statusCounts.reduce((prev, current) =>
      current.count > prev.count ? current : prev
    )
    
    // Only set if there are tickets in that status
    if (highestCountStatus.count > 0) {
      setSelectedStatus(highestCountStatus.status)
    }
  }, [tickets, isMobile, selectedStatus])

  const handleSearchChange = (status: TicketStatus, query: string) => {
    setSearchQueries((prev) => ({ ...prev, [status]: query }))
  }

  const handleSortChange = (status: TicketStatus, sort: 'date' | 'urgency') => {
    setSortBy((prev) => ({ ...prev, [status]: sort }))
  }

  const getTicketsByStatus = (status: TicketStatus) => {
    if (!ticketsArray || ticketsArray.length === 0) return []
    
    let statusTickets = ticketsArray.filter((ticket: Ticket) => ticket.status === status)
    
    // Apply search filter (text matching on description, problemDescription, etc.)
    const searchQuery = searchQueries[status]
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase()
      statusTickets = statusTickets.filter((ticket) => {
        const searchText = [
          ticket.description,
          ticket.problemDescription,
          ticket.issueType,
          ticket.location,
          ...(ticket.predictedTags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return searchText.includes(queryLower)
      })
    }
    
    // Apply sorting - always default to date descending (latest first)
    if (sortBy[status] === 'urgency') {
      const urgencyOrder: Record<string, number> = {
        emergency: 0,
        urgent: 1,
        normal: 2,
        low: 3,
      }
      statusTickets.sort((a, b) => {
        const aOrder = a.urgency ? urgencyOrder[a.urgency] ?? 4 : 4
        const bOrder = b.urgency ? urgencyOrder[b.urgency] ?? 4 : 4
        if (aOrder !== bOrder) {
          return aOrder - bOrder
        }
        // If same urgency, sort by updatedAt descending (most recent activity first), fallback to createdAt
        // Use _id as tiebreaker for stable sorting when timestamps are equal
        const aTime = a.updatedAt ?? a.createdAt
        const bTime = b.updatedAt ?? b.createdAt
        const dateDiff = bTime - aTime
        if (dateDiff !== 0) return dateDiff
        return a._id.localeCompare(b._id)
      })
    } else {
      // Sort by updatedAt descending (most recent activity first), fallback to createdAt - DEFAULT
      // Use _id as tiebreaker for stable sorting when timestamps are equal
      statusTickets.sort((a, b) => {
        // Use updatedAt if available, otherwise fallback to createdAt
        const aTime = a.updatedAt ?? a.createdAt
        const bTime = b.updatedAt ?? b.createdAt
        const dateDiff = bTime - aTime
        if (dateDiff !== 0) return dateDiff
        // If timestamps are equal, sort by _id for consistent ordering
        return a._id.localeCompare(b._id)
      })
    }
    
    return statusTickets
  }

  // Show loading state with skeleton loaders
  if (isLoading) {
    return (
      <main className="flex flex-col flex-1 overflow-hidden min-h-0">
        {/* Tabs Section - Mobile Only (< md) */}
        <section className="md:hidden w-full border-b p-4 shrink-0">
          <Tabs value="all">
            <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide">
              {TICKET_STATUSES.map((status) => (
                <TabsTrigger key={status.value} value={status.value} className="shrink-0">
                  <Skeleton className="h-5 w-24" />
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </section>

        {/* Kanban Board Section with Skeletons */}
        <section className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
          <section className="flex flex-row gap-4 h-full p-4 w-full md:min-w-max md:w-auto">
            {TICKET_STATUSES.map((status) => (
              <section
                key={status.value}
                className="flex flex-col w-full md:w-80 shrink-0 bg-background rounded-3xl"
              >
                {/* Column Header Skeleton */}
                <header className="p-4 shrink-0">
                  <section className="flex items-center justify-between">
                    <section className="flex items-center gap-4">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-8 rounded-full" />
                    </section>
                    <section className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded" />
                      <Skeleton className="h-8 w-8 rounded" />
                    </section>
                  </section>
                </header>

                {/* Column Content Skeleton */}
                <section className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-0">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <section
                      key={i}
                      className="p-4 bg-card rounded-lg border border-border"
                    >
                      <section className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                        <section className="flex items-center gap-2 mt-2">
                          <Skeleton className="h-4 w-16 rounded-full" />
                          <Skeleton className="h-4 w-20 rounded-full" />
                        </section>
                      </section>
                    </section>
                  ))}
                </section>
              </section>
            ))}
          </section>
        </section>
      </main>
    )
  }

  return (
    <main className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Tabs Section - Mobile Only (< md) */}
      <section className="md:hidden w-full border-b p-4 shrink-0">
        <Tabs
          value={selectedStatus}
          onValueChange={(value) => setSelectedStatus(value as TicketStatus | 'all')}
        >
          <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide">
            {TICKET_STATUSES.map((status) => {
              const count = getTicketsByStatus(status.value).length
              return (
                <TabsTrigger key={status.value} value={status.value} className="shrink-0">
                  {status.label} ({count})
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </section>

      {/* Kanban Board Section */}
      <section className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
        <section className="flex flex-row gap-4 h-full p-4 w-full md:min-w-max md:w-auto">
          {TICKET_STATUSES.map((status) => {
            const statusTickets = getTicketsByStatus(status.value)
            const isSelected = selectedStatus === status.value
            // On mobile: only show selected column
            // On desktop: always show all columns (selectedStatus should be 'all' on desktop)
            const shouldShow = isMobile 
              ? isSelected 
              : true // Desktop always shows all columns

            return (
              <TicketStatusColumn
                key={status.value}
                title={status.label}
                count={statusTickets.length}
                isSelected={shouldShow}
                searchQuery={searchQueries[status.value]}
                onSearchChange={(query) => handleSearchChange(status.value, query)}
                sortBy={sortBy[status.value]}
                onSortChange={(sort) => handleSortChange(status.value, sort)}
              >
                {statusTickets.map((ticket) => (
                  <TicketCard
                    key={ticket._id}
                    title={ticket.description}
                    description={ticket.description}
                    problemDescription={ticket.problemDescription}
                    ticketName={ticket.ticketName}
                    photoUrls={ticket.photoUrls}
                    urgency={ticket.urgency}
                    location={ticket.location}
                    date={formatDate(ticket.createdAt)}
                    issueType={ticket.issueType}
                    status={ticket.status}
                    onClick={() => {
                      navigate({ to: `/tickets/${ticket._id}` })
                    }}
                    onEdit={() => {
                      navigate({ to: `/tickets/${ticket._id}/edit` })
                    }}
                    onDelete={async () => {
                      if (!user?.id) return

                      try {
                        await deleteTicket({
                          ticketId: ticket._id as any,
                          userId: user.id as any,
                        })

                        toast.success(t($ => $.tickets.list.deleteSuccess), {
                          description: t($ => $.tickets.list.deleteSuccessDescription),
                          duration: 3000,
                        })
                      } catch (error) {
                        toast.error(t($ => $.tickets.list.deleteError), {
                          description: error instanceof Error ? error.message : t($ => $.tickets.list.deleteErrorDescription),
                          duration: 5000,
                        })
                      }
                    }}
                  />
                ))}
              </TicketStatusColumn>
            )
          })}
        </section>
      </section>
    </main>
  )
}
