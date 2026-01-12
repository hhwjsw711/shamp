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
import { useTranslation } from 'react-i18next'
import AnalyticsCard from '@/components/layout/analytics-card'
import VendorPerformanceChart from '@/components/layout/vendor-performance-chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/convex-api'

export const Route = createFileRoute('/_authenticated/')({
  component: App,
})

function useStatusLabel() {
  const { t } = useTranslation()

  return (status: string): string => {
    const statusMap: Record<string, string> = {
      analyzing: t($ => $.dashboard.ticketStats.analyzing),
      analyzed: t($ => $.dashboard.ticketStats.analyzed),
      reviewed: t($ => $.dashboard.ticketStats.reviewed),
      find_vendors: t($ => $.dashboard.ticketStats.findingVendors),
      requested_for_information: t($ => $.dashboard.ticketStats.requestedForInfo),
      quotes_available: t($ => $.dashboard.ticketStats.quotesAvailable),
      quote_selected: t($ => $.dashboard.ticketStats.quoteSelected),
      fixed: t($ => $.dashboard.ticketStats.fixed),
      closed: t($ => $.dashboard.ticketStats.closed),
    }
    return statusMap[status] || status
  }
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
  vendorPerformance: Array<{
    vendorId: string
    businessName: string
    ticketCount: number
    averageResponseTimeHours: number | null
    averageFixTimeHours: number | null
  }>
}

function App() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const { t } = useTranslation()
  const getStatusLabel = useStatusLabel()

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
  // Show loading if:
  // 1. Auth is loading (includes getCurrentUser and Convex query loading)
  // 2. Query is loading (when authenticated and user exists)
  const isLoading = authLoading || (statsResult === undefined && isAuthenticated && user)
  const hasError = statsResult === null
  const stats: DashboardStats | undefined = statsResult ?? undefined

  if (isLoading) {
    return (
      <section className="flex flex-col h-full overflow-hidden">
        {/* Header - Fixed */}
        <header className="shrink-0 p-4 pb-2">
          <section className="flex flex-col gap-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-80 mt-1" />
          </section>
        </header>

        {/* Content - Scrollable */}
        <section className="flex-1 overflow-y-auto p-4 pt-2 flex flex-col gap-6 min-h-0">
          {/* Ticket Statistics Skeleton */}
          <section className="flex flex-col gap-2">
            <Skeleton className="h-7 w-40" />
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <section key={i} className="flex flex-col gap-0 p-0 rounded-[24px] border-0 shadow-none bg-card">
                  <section className="flex flex-row items-center gap-4 py-2 px-4">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="h-4 w-32" />
                  </section>
                  <section className="p-2">
                    <section className="p-2 bg-zinc-100 rounded-2xl">
                      <Skeleton className="h-8 w-16" />
                    </section>
                  </section>
                </section>
              ))}
            </section>
          </section>

          {/* Quote Statistics Skeleton */}
          <section className="flex flex-col gap-2">
            <Skeleton className="h-7 w-40" />
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <section key={i} className="flex flex-col gap-0 p-0 rounded-[24px] border-0 shadow-none bg-card">
                  <section className="flex flex-row items-center gap-4 py-2 px-4">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="h-4 w-32" />
                  </section>
                  <section className="p-2">
                    <section className="p-2 bg-zinc-100 rounded-2xl">
                      <section className="flex flex-col gap-1">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </section>
                    </section>
                  </section>
                </section>
              ))}
            </section>
          </section>

          {/* Performance Metrics Skeleton */}
          <section className="flex flex-col gap-4">
            <Skeleton className="h-7 w-48" />
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <section key={i} className="flex flex-col gap-0 p-0 rounded-[24px] border-0 shadow-none bg-card">
                  <section className="flex flex-row items-center gap-4 py-2 px-4">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="h-4 w-36" />
                  </section>
                  <section className="p-2">
                    <section className="p-2 bg-zinc-100 rounded-2xl">
                      <section className="flex flex-col gap-1">
                        <Skeleton className="h-7 w-32" />
                        <Skeleton className="h-4 w-48" />
                      </section>
                    </section>
                  </section>
                </section>
              ))}
            </section>

            {/* Vendor Performance Chart Skeleton */}
            <section className="flex flex-col gap-0 p-0 rounded-[24px] border-0 shadow-none bg-card">
              <section className="flex flex-col gap-1 py-2 px-4">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-3 w-80" />
              </section>
              <section className="p-2">
                <section className="p-2 bg-zinc-100 rounded-2xl">
                  <Skeleton className="h-[250px] sm:h-[300px] w-full rounded-lg" />
                </section>
              </section>
            </section>
          </section>
        </section>
      </section>
    )
  }

  if (hasError) {
    return (
      <section className="flex flex-col gap-2 p-4">
        <section className="flex items-center justify-center h-64">
          <p className="text-destructive">{t($ => $.dashboard.errors.loadFailed)}</p>
        </section>
      </section>
    )
  }

  if (!stats) {
    return (
      <section className="flex flex-col gap-2 p-4">
        <p>{t($ => $.common.messages.noData)}</p>
      </section>
    )
  }

  return (
    <section className="flex flex-col h-full overflow-hidden">
      {/* Header - Fixed */}
      <header className="shrink-0 p-4 pb-2">
        <section className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t($ => $.dashboard.title)}</h1>
          <p className="text-sm text-muted-foreground">
            {t($ => $.dashboard.subtitle)}
          </p>
        </section>
      </header>

      {/* Content - Scrollable */}
      <section className="flex-1 overflow-y-auto p-4 pt-2 flex flex-col gap-6 min-h-0">
        {/* Ticket Statistics */}
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t($ => $.dashboard.ticketStats.title)}</h2>
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsCard
          icon={<Ticket className="w-5 h-5" />}
          name={t($ => $.dashboard.ticketStats.total)}
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
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t($ => $.dashboard.quoteStats.title)}</h2>
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnalyticsCard
          icon={<FileText className="w-5 h-5" />}
          name={t($ => $.dashboard.quoteStats.newQuotes)}
          value={
            <section className="flex flex-col gap-1">
              <span className="text-3xl font-semibold">{stats.newQuotesCount}</span>
              <p className="text-xs text-muted-foreground">{t($ => $.dashboard.quoteStats.awaitingReview)}</p>
            </section>
          }
        />

        <AnalyticsCard
          icon={<AlertCircle className="w-5 h-5" />}
          name={t($ => $.dashboard.quoteStats.ticketsAwaitingSelection)}
          value={
            <section className="flex flex-col gap-1">
              <span className="text-3xl font-semibold">{stats.ticketsAwaitingSelection}</span>
              <p className="text-xs text-muted-foreground">{t($ => $.dashboard.quoteStats.haveQuotesNoVendor)}</p>
            </section>
          }
        />

        <AnalyticsCard
          icon={<CheckCircle className="w-5 h-5" />}
          name={t($ => $.dashboard.quoteStats.selectedQuotes)}
          value={
            <section className="flex flex-col gap-1">
              <span className="text-3xl font-semibold">{stats.selectedQuotesCount}</span>
              <p className="text-xs text-muted-foreground">{t($ => $.dashboard.quoteStats.selectedVendors)}</p>
            </section>
          }
        />
          </section>
        </section>

        {/* Performance Metrics */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{t($ => $.dashboard.performance.title)}</h2>
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnalyticsCard
          icon={<Clock className="w-5 h-5" />}
          name={t($ => $.dashboard.performance.avgResponseTime)}
          value={
            <section className="flex flex-col gap-1">
              <p className="text-2xl font-semibold">
                {stats.averageResponseTimeHours !== null
                  ? `${stats.averageResponseTimeHours.toFixed(2)} ${t($ => $.dashboard.performance.hours)}`
                  : `0 ${t($ => $.dashboard.performance.hours)}`}
              </p>
              <p className="text-sm text-muted-foreground">{t($ => $.dashboard.performance.responseTimeDesc)}</p>
            </section>
          }
        />

        <AnalyticsCard
          icon={<Wrench className="w-5 h-5" />}
          name={t($ => $.dashboard.performance.avgFixTime)}
          value={
            <section className="flex flex-col gap-1">
              <p className="text-2xl font-semibold">
                {stats.averageFixTimeHours !== null
                  ? `${stats.averageFixTimeHours.toFixed(2)} ${t($ => $.dashboard.performance.hours)}`
                  : `0 ${t($ => $.dashboard.performance.hours)}`}
              </p>
              <p className="text-sm text-muted-foreground">{t($ => $.dashboard.performance.fixTimeDesc)}</p>
            </section>
          }
        />

        <AnalyticsCard
          icon={<Building2 className="w-5 h-5" />}
          name={t($ => $.dashboard.performance.mostUsedVendor)}
          value={
            <section className="flex flex-col gap-1">
              <p className="text-lg font-semibold">
                {stats.mostUsedVendor?.businessName || t($ => $.dashboard.performance.noVendorYet)}
              </p>
              <p className="text-sm text-muted-foreground">
                {stats.mostUsedVendor?.usageCount || 0} {t($ => $.dashboard.performance.tickets)}
              </p>
            </section>
          }
        />
          </section>

          {/* Vendor Performance Chart */}
          <VendorPerformanceChart data={stats.vendorPerformance} />
        </section>

        {/* Quote Averages */}
        {(stats.averageQuotePrice !== null || stats.averageQuoteDeliveryTimeHours !== null) && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t($ => $.dashboard.quoteAverages.title)}</h2>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.averageQuotePrice !== null && (
            <AnalyticsCard
              icon={<DollarSign className="w-5 h-5" />}
              name={t($ => $.dashboard.quoteAverages.avgPrice)}
              value={
                <section className="flex flex-col gap-1">
                  <p className="text-2xl font-semibold">
                    ${(stats.averageQuotePrice / 100).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">{t($ => $.dashboard.quoteAverages.priceDesc)}</p>
                </section>
              }
            />
          )}

          {stats.averageQuoteDeliveryTimeHours !== null && (
            <AnalyticsCard
              icon={<Package className="w-5 h-5" />}
              name={t($ => $.dashboard.quoteAverages.avgDeliveryTime)}
              value={
                <section className="flex flex-col gap-1">
                  <p className="text-2xl font-semibold">
                    {stats.averageQuoteDeliveryTimeHours.toFixed(2)} {t($ => $.dashboard.performance.hours)}
                  </p>
                  <p className="text-sm text-muted-foreground">{t($ => $.dashboard.quoteAverages.deliveryTimeDesc)}</p>
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
