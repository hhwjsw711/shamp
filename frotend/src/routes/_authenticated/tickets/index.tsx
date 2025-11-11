import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { api } from '@/lib/api'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'

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

function getUrgencyColor(urgency?: string) {
  switch (urgency) {
    case 'emergency':
      return 'destructive'
    case 'urgent':
      return 'destructive'
    case 'normal':
      return 'default'
    case 'low':
      return 'secondary'
    default:
      return 'outline'
  }
}

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
              <div
                key={status.value}
                className={`flex flex-col w-80 shrink-0 bg-muted/50 rounded-lg border ${
                  selectedStatus !== 'all' && !isSelected ? 'hidden md:flex' : 'flex'
                }`}
              >
                {/* Column Header */}
                <header className="p-4 border-b shrink-0">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-sm">{status.label}</h2>
                    <Badge variant="secondary" className="ml-2">
                      {statusTickets.length}
                    </Badge>
                  </div>
                </header>

                {/* Column Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  {statusTickets.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      No tickets
                    </div>
                  ) : (
                    statusTickets.map((ticket) => (
                      <TicketCard key={ticket._id} ticket={ticket} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium line-clamp-2">
            {ticket.description}
          </CardTitle>
          {ticket.urgency && (
            <Badge variant={getUrgencyColor(ticket.urgency) as any} className="shrink-0">
              {ticket.urgency}
            </Badge>
          )}
        </div>
        {ticket.location && (
          <CardDescription className="text-xs mt-1">{ticket.location}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatDate(ticket.createdAt)}</span>
          {ticket.photoIds.length > 0 && (
            <span className="flex items-center gap-1">
              📷 {ticket.photoIds.length}
            </span>
          )}
        </div>
        {ticket.issueType && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              {ticket.issueType}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
