import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { 
  AlertCircle,
  Building2,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Package,
  Ticket,
  Wrench
} from 'lucide-react'
import AnalyticsCard from '@/components/layout/analytics-card'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/convex-api'

export const Route = createFileRoute('/_authenticated/')({
  component: App,
})

function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    analyzing: 'Analyzing',
    analyzed: 'Analyzed',
    reviewed: 'Reviewed',
    find_vendors: 'Finding Vendors',
    requested_for_information: 'Requested for Information',
    quotes_available: 'Quotes Available',
    quote_selected: 'Quote Selected',
    fixed: 'Fixed',
    closed: 'Closed',
  }
  return statusMap[status] || status
}

// Define ticket status flow order (excluding analyzing and quote_selected)
const TICKET_STATUS_ORDER = [
  'analyzed',
  'reviewed',
  'find_vendors',
  'requested_for_information',
  'quotes_available',
  'fixed',
  'closed',
] as const

interface DashboardStats {
  totalTickets: number
  ticketCountsByStatus: Record<string, number>
  averageResponseTimeMs: number | null
  averageResponseTimeHours: number | null
  averageFixTimeMs: number | null
  averageFixTimeHours: number | null
  mostUsedVendor: {
    _id: string
    businessName: string
    usageCount: number
  } | null
  newQuotesCount: number
  pendingQuotesCount: number
  selectedQuotesCount: number
  rejectedQuotesCount: number
  expiredQuotesCount: number
  totalQuotesReceived: number
  ticketsAwaitingSelection: number
  averageQuotePrice: number | null
  averageQuoteDeliveryTimeHours: number | null
}

function App() {
  const { user, isAuthenticated } = useAuth()

  // Use Convex query for real-time dashboard stats
  // SECURITY: userId is validated on the backend - users can only see their own stats
  const statsResult = useQuery(
    api.functions.analytics.queries.getDashboardStats,
    user?.id && isAuthenticated
      ? { userId: user.id as any } // Type assertion - backend validates userId
      : 'skip' // Skip query if not authenticated
  ) as DashboardStats | undefined | null

  // Handle loading and error states
  // When query is skipped (not authenticated), statsResult is undefined
  // When loading, statsResult is undefined  
  // When error, statsResult is null
  // When success, statsResult is DashboardStats
  const isLoading = statsResult === undefined && isAuthenticated
  const hasError = statsResult === null
  const stats: DashboardStats | undefined = statsResult ?? undefined

  if (isLoading) {
    return (
      <section className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-center h-64">
          <Spinner className="w-8 h-8" />
        </div>
      </section>
    )
  }

  if (hasError) {
    return (
      <section className="flex flex-col gap-2 p-4">
        <section className="flex items-center justify-center h-64">
          <p className="text-destructive">Failed to load dashboard statistics</p>
        </section>
      </section>
    )
  }

  if (!stats) {
    return (
      <section className="flex flex-col gap-2 p-4">
        <p>No data available</p>
      </section>
    )
  }

  return (
    <section className="flex flex-col h-full overflow-hidden">
      {/* Header - Fixed */}
      <header className="shrink-0 p-4 pb-2">
        <section className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your tickets, quotes, and performance metrics
          </p>
        </section>
      </header>

      {/* Content - Scrollable */}
      <section className="flex-1 overflow-y-auto p-4 pt-2 flex flex-col gap-6 min-h-0">
        {/* Ticket Statistics */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Ticket Statistics</h2>
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsCard
          icon={<Ticket className="w-5 h-5" />}
          name="Total Tickets"
          value={<span className="text-3xl font-semibold">{stats.totalTickets}</span>}
        />

        {TICKET_STATUS_ORDER.map((status) => (
          <AnalyticsCard
            key={status}
            icon={<Ticket className="w-5 h-5" />}
            name={getStatusLabel(status)}
            value={<span className="text-3xl font-semibold">{stats.ticketCountsByStatus[status] || 0}</span>}
          />
        ))}
          </section>
        </section>

        {/* Quote Statistics */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Quote Statistics</h2>
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnalyticsCard
          icon={<FileText className="w-5 h-5" />}
          name="New Quotes"
          value={
            <section className="flex flex-col gap-1">
              <span className="text-3xl font-semibold">{stats.newQuotesCount}</span>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </section>
          }
        />

        <AnalyticsCard
          icon={<AlertCircle className="w-5 h-5" />}
          name="Tickets Awaiting Selection"
          value={
            <section className="flex flex-col gap-1">
              <span className="text-3xl font-semibold">{stats.ticketsAwaitingSelection}</span>
              <p className="text-xs text-muted-foreground">Have quotes but no vendor selected</p>
            </section>
          }
        />

        <AnalyticsCard
          icon={<CheckCircle className="w-5 h-5" />}
          name="Selected Quotes"
          value={
            <section className="flex flex-col gap-1">
              <span className="text-3xl font-semibold">{stats.selectedQuotesCount}</span>
              <p className="text-xs text-muted-foreground">Selected vendors</p>
            </section>
          }
        />
          </section>
        </section>

        {/* Performance Metrics */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Performance Metrics</h2>
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.averageResponseTimeHours !== null && (
          <AnalyticsCard
            icon={<Clock className="w-5 h-5" />}
            name="Average Response Time"
            value={
              <section className="flex flex-col gap-1">
                <p className="text-2xl font-semibold">
                  {stats.averageResponseTimeHours.toFixed(2)} hours
                </p>
                <p className="text-sm text-muted-foreground">Time from ticket creation to first vendor reply</p>
              </section>
            }
          />
        )}

        {stats.averageFixTimeHours !== null && (
          <AnalyticsCard
            icon={<Wrench className="w-5 h-5" />}
            name="Average Fix Time"
            value={
              <section className="flex flex-col gap-1">
                <p className="text-2xl font-semibold">
                  {stats.averageFixTimeHours.toFixed(2)} hours
                </p>
                <p className="text-sm text-muted-foreground">Time from ticket creation to closure</p>
              </section>
            }
          />
        )}

        {stats.mostUsedVendor && (
          <AnalyticsCard
            icon={<Building2 className="w-5 h-5" />}
            name="Most Used Vendor"
            value={
              <section className="flex flex-col gap-1">
                <p className="text-lg font-semibold">{stats.mostUsedVendor.businessName}</p>
                <p className="text-sm text-muted-foreground">
                  {stats.mostUsedVendor.usageCount} ticket{stats.mostUsedVendor.usageCount !== 1 ? 's' : ''}
                </p>
              </section>
            }
          />
        )}
          </section>
        </section>

        {/* Quote Averages */}
        {(stats.averageQuotePrice !== null || stats.averageQuoteDeliveryTimeHours !== null) && (
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Quote Averages</h2>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.averageQuotePrice !== null && (
            <AnalyticsCard
              icon={<DollarSign className="w-5 h-5" />}
              name="Average Quote Price"
              value={
                <section className="flex flex-col gap-1">
                  <p className="text-2xl font-semibold">
                    ${(stats.averageQuotePrice / 100).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">Average price of received quotes</p>
                </section>
              }
            />
          )}

          {stats.averageQuoteDeliveryTimeHours !== null && (
            <AnalyticsCard
              icon={<Package className="w-5 h-5" />}
              name="Average Delivery Time"
              value={
                <section className="flex flex-col gap-1">
                  <p className="text-2xl font-semibold">
                    {stats.averageQuoteDeliveryTimeHours.toFixed(2)} hours
                  </p>
                  <p className="text-sm text-muted-foreground">Average estimated delivery time from quotes</p>
                </section>
              }
            />
          )}
            </section>
          </section>
        )}
      </section>
    </section>  
  )
}
