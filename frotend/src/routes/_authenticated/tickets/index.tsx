import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { api } from '@/lib/api'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TicketStatusColumn } from '@/components/layout/ticket-status-column'
import { TicketCard } from '@/components/layout/ticket-card'

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
  description: string
  location?: string
  status: TicketStatus
  urgency?: 'emergency' | 'urgent' | 'normal' | 'low'
  issueType?: string
  predictedTags?: Array<string>
  problemDescription?: string
  photoIds: Array<string>
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
  const [tickets, setTickets] = useState<Array<Ticket>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | 'all'>('all')

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await api.tickets.list()
      if (response.success) {
        // Cast status to TicketStatus type
        setTickets(response.tickets as Array<Ticket>)
      } else {
        setError('Failed to load tickets')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets')
    } finally {
      setIsLoading(false)
    }
  }

  const getTicketsByStatus = (status: TicketStatus) => {
    return tickets.filter((ticket) => ticket.status === status)
  }

  if (isLoading) {
    return (
      <main className="flex items-center justify-center h-full">
        <Spinner className="size-8" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex items-center justify-center h-full p-4">
        <Alert variant="destructive" className="max-w-md">
          <TriangleAlert className="size-4" />
          <AlertDescription>{error}</AlertDescription>
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
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            {TICKET_STATUSES.map((status) => (
              <TabsTrigger key={status.value} value={status.value}>
                {status.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </section>

      {/* Kanban Board Section */}
      <section className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
        <div className="flex flex-row gap-4 h-full p-4 min-w-max">
          {TICKET_STATUSES.map((status) => {
            const statusTickets = getTicketsByStatus(status.value)
            const isSelected = selectedStatus === status.value

            return (
              <TicketStatusColumn
                key={status.value}
                title={status.label}
                count={statusTickets.length}
                isSelected={selectedStatus === 'all' || isSelected}
              >
                {statusTickets.map((ticket) => (
                  <TicketCard
                    key={ticket._id}
                    title={ticket.description}
                    urgency={ticket.urgency}
                    location={ticket.location}
                    date={formatDate(ticket.createdAt)}
                    photoCount={ticket.photoIds.length}
                    issueType={ticket.issueType}
                    onClick={() => {
                      // TODO: Navigate to ticket detail page
                      console.log('Clicked ticket:', ticket._id)
                    }}
                  />
                ))}
              </TicketStatusColumn>
            )
          })}
        </div>
      </section>
    </main>
  )
}


