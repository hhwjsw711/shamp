import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TicketStatusColumn } from '@/components/layout/ticket-status-column'
import { TicketCard } from '@/components/layout/ticket-card'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/convex-api'

export const Route = createFileRoute('/_authenticated/tickets/')({
  component: TicketsPage,
})

type TicketStatus =
  | 'pending'
  | 'analyzed'
  | 'processing'
  | 'vendors_available'
  | 'vendor_selected'
  | 'vendor_scheduled'
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
}

const TICKET_STATUSES: Array<{ value: TicketStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'analyzed', label: 'Analyzed' },
  { value: 'processing', label: 'Processing' },
  { value: 'vendors_available', label: 'Vendors Available' },
  { value: 'vendor_selected', label: 'Vendor Selected' },
  { value: 'vendor_scheduled', label: 'Scheduled' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'closed', label: 'Closed' },
]

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
  const [isMobile, setIsMobile] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | 'all'>('all')
  
  // Search and sort state per status
  const [searchQueries, setSearchQueries] = useState<Record<TicketStatus, string>>({
    pending: '',
    analyzed: '',
    processing: '',
    vendors_available: '',
    vendor_selected: '',
    vendor_scheduled: '',
    fixed: '',
    closed: '',
  })
  
  const [sortBy, setSortBy] = useState<Record<TicketStatus, 'date' | 'urgency'>>({
    pending: 'date',
    analyzed: 'date',
    processing: 'date',
    vendors_available: 'date',
    vendor_selected: 'date',
    vendor_scheduled: 'date',
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
  // useQuery returns undefined while loading, array when loaded, or null on error
  const isLoading = ticketsResult === undefined && isAuthenticated
  const hasError = ticketsResult === null
  const tickets = ticketsResult as Array<Ticket> | undefined

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
    if (!tickets || tickets.length === 0 || !isMobile || selectedStatus !== 'all') return
    
    // Calculate raw counts for each status (without search/sort filters)
    const statusCounts = TICKET_STATUSES.map((status) => ({
      status: status.value,
      count: tickets.filter((ticket) => ticket.status === status.value).length,
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
    if (!tickets) return []
    
    let statusTickets = tickets.filter((ticket: Ticket) => ticket.status === status)
    
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
    
    // Apply sorting
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
        // If same urgency, sort by date descending
        return b.createdAt - a.createdAt
      })
    } else {
      // Sort by date descending (most recent first)
      statusTickets.sort((a, b) => b.createdAt - a.createdAt)
    }
    
    return statusTickets
  }

  // Show loading state
  if (isLoading) {
    return (
      <main className="flex items-center justify-center h-full">
        <Spinner className="size-8" />
      </main>
    )
  }

  // Show error state
  if (hasError) {
    return (
      <main className="flex items-center justify-center h-full p-4">
        <Alert variant="destructive" className="max-w-md">
          <TriangleAlert className="size-4" />
          <AlertDescription>Failed to load tickets</AlertDescription>
        </Alert>
      </main>
    )
  }

  // Show empty state if no tickets
  if (!tickets || tickets.length === 0) {
    return (
      <main className="flex items-center justify-center h-full p-4">
        <Alert className="max-w-md">
          <AlertDescription>No tickets found. Create your first ticket to get started.</AlertDescription>
        </Alert>
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
                      // TODO: Navigate to ticket detail page
                      console.log('Clicked ticket:', ticket._id)
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
                        
                        toast.success('Ticket Deleted', {
                          description: 'The ticket has been successfully deleted.',
                          duration: 3000,
                        })
                      } catch (error) {
                        toast.error('Failed to Delete Ticket', {
                          description: error instanceof Error ? error.message : 'An error occurred while deleting the ticket.',
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
