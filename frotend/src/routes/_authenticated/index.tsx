import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/')({
  component: App,
})

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
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await api.analytics.getDashboardStats()
        if (response.success && response.data) {
          setStats(response.data)
        } else {
          setError('Failed to load dashboard statistics')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard statistics')
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (isLoading) {
    return (
      <section className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-center h-64">
          <Spinner className="w-8 h-8" />
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">{error}</p>
        </div>
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
    <section className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your tickets, quotes, and performance metrics
        </p>
      </div>

      {/* Ticket Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tickets</CardDescription>
            <CardTitle className="text-3xl">{stats.totalTickets}</CardTitle>
          </CardHeader>
        </Card>

        {Object.entries(stats.ticketCountsByStatus).map(([status, count]) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardDescription>{status}</CardDescription>
              <CardTitle className="text-3xl">{count}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.averageResponseTimeHours !== null && (
          <Card>
            <CardHeader>
              <CardTitle>Average Response Time</CardTitle>
              <CardDescription>Time from ticket creation to first vendor reply</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {stats.averageResponseTimeHours.toFixed(2)} hours
              </p>
            </CardContent>
          </Card>
        )}

        {stats.averageFixTimeHours !== null && (
          <Card>
            <CardHeader>
              <CardTitle>Average Fix Time</CardTitle>
              <CardDescription>Time from ticket creation to closure</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {stats.averageFixTimeHours.toFixed(2)} hours
              </p>
            </CardContent>
          </Card>
        )}

        {stats.mostUsedVendor && (
          <Card>
            <CardHeader>
              <CardTitle>Most Used Vendor</CardTitle>
              <CardDescription>Vendor with most assigned tickets</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{stats.mostUsedVendor.businessName}</p>
              <p className="text-sm text-muted-foreground">
                {stats.mostUsedVendor.usageCount} ticket{stats.mostUsedVendor.usageCount !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quote Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>New Quotes</CardDescription>
            <CardTitle className="text-3xl">{stats.newQuotesCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Quotes</CardDescription>
            <CardTitle className="text-3xl">{stats.pendingQuotesCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting vendor response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Selected Quotes</CardDescription>
            <CardTitle className="text-3xl">{stats.selectedQuotesCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tickets Awaiting Selection</CardDescription>
            <CardTitle className="text-3xl">{stats.ticketsAwaitingSelection}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Have quotes but no vendor selected</p>
          </CardContent>
        </Card>
      </div>

      {/* Quote Averages */}
      {(stats.averageQuotePrice !== null || stats.averageQuoteDeliveryTimeHours !== null) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.averageQuotePrice !== null && (
            <Card>
              <CardHeader>
                <CardTitle>Average Quote Price</CardTitle>
                <CardDescription>Average price of received quotes</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  ${(stats.averageQuotePrice / 100).toFixed(2)}
                </p>
              </CardContent>
            </Card>
          )}

          {stats.averageQuoteDeliveryTimeHours !== null && (
            <Card>
              <CardHeader>
                <CardTitle>Average Delivery Time</CardTitle>
                <CardDescription>Average estimated delivery time from quotes</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {stats.averageQuoteDeliveryTimeHours.toFixed(2)} hours
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </section>
  )
}
