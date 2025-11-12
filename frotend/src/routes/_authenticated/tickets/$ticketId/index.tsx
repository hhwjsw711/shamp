import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Calendar, MapPin, Tag, TriangleAlert, X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { api as convexApi } from '@/lib/convex-api'

export const Route = createFileRoute('/_authenticated/tickets/$ticketId/')({
  component: TicketDetailsPage,
})

function getUrgencyStyles(urgency?: string) {
  switch (urgency) {
    case 'emergency':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'urgent':
      return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'normal':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'low':
      return 'bg-green-100 text-green-700 border-green-200'
    default:
      return ''
  }
}

function getUrgencyLabel(urgency?: string) {
  switch (urgency) {
    case 'emergency':
      return 'Emergency'
    case 'urgent':
      return 'Urgent'
    case 'normal':
      return 'Normal'
    case 'low':
      return 'Low'
    default:
      return 'Not specified'
  }
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TicketDetailsPage() {
  const { ticketId } = Route.useParams()
  const { user, isAuthenticated } = useAuth()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Use Convex query for real-time ticket data
  const ticketResult = useQuery(
    convexApi.functions.tickets.queries.getById,
    user?.id && isAuthenticated && ticketId
      ? { ticketId: ticketId as any, userId: user.id as any }
      : 'skip'
  )

  // Handle loading and error states
  const isLoading = ticketResult === undefined && isAuthenticated
  const ticket = ticketResult || null

  // Show loading state
  if (isLoading) {
    return (
      <main className="flex items-center justify-center h-full">
        <Spinner className="size-8" />
      </main>
    )
  }

  // Show error state
  if (ticketResult === null || !ticket) {
    return (
      <main className="flex items-center justify-center h-full p-4">
        <Alert variant="destructive" className="max-w-md">
          <TriangleAlert className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {ticketResult === null ? 'Failed to load ticket' : 'Ticket not found'}
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  // Filter out null/undefined photoUrls (ticket is guaranteed to be non-null here)
  const validPhotoUrls = ticket.photoUrls.filter((url): url is string => Boolean(url))

  return (
    <section>
      <section className="flex flex-col items-center gap-6 p-4 md:p-6 lg:p-8 overflow-y-auto max-h-full">
        <Card className="border-0 rounded-2xl shadow-none max-w-4xl w-full">
          <CardHeader>
            <CardTitle className="text-2xl">
              {ticket.status === 'analyzing' 
                ? 'Awaiting ticket name' 
                : ticket.ticketName || 'Ticket Details'}
            </CardTitle>
            <CardDescription>
              View all information about this maintenance request
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Images Section */}
            {validPhotoUrls.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-4">Photos</h3>
                <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {validPhotoUrls.map((url, index) => (
                    <section
                      key={index}
                      className="group relative aspect-square cursor-pointer"
                      onClick={() => setSelectedImage(url)}
                    >
                      <img
                        src={url}
                        alt={`Ticket photo ${index + 1}`}
                        className="h-full w-full rounded-lg border object-cover transition-transform group-hover:scale-105"
                      />
                      <section className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </section>
                  ))}
                </section>
              </section>
            )}

            {/* Ticket Information Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Description */}
              <section className="md:col-span-2">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
                <p className="text-base whitespace-pre-wrap">{ticket.description || 'No description provided'}</p>
              </section>

              {/* Problem Description */}
              {ticket.problemDescription && (
                <section className="md:col-span-2">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Problem Analysis</h3>
                  <p className="text-base whitespace-pre-wrap">{ticket.problemDescription}</p>
                </section>
              )}

              {/* Issue Type */}
              {ticket.issueType && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Tag className="size-4" />
                    Issue Type
                  </h3>
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {ticket.issueType}
                  </Badge>
                </section>
              )}

              {/* Urgency */}
              <section>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Urgency</h3>
                <Badge
                  variant="outline"
                  className={`text-base px-3 py-1 ${getUrgencyStyles(ticket.urgency)}`}
                >
                  {getUrgencyLabel(ticket.urgency)}
                </Badge>
              </section>

              {/* Location */}
              {ticket.location && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <MapPin className="size-4" />
                    Location
                  </h3>
                  <p className="text-base">{ticket.location}</p>
                </section>
              )}

              {/* Date */}
              <section>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Calendar className="size-4" />
                  Created Date
                </h3>
                <p className="text-base">{formatDate(ticket.createdAt)}</p>
              </section>
            </section>
          </CardContent>
        </Card>
      </section>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-h-full max-w-full"
            >
              <img
                src={selectedImage}
                alt="Preview"
                className="max-h-full max-w-full rounded-lg object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <Button
                type="button"
                onClick={() => setSelectedImage(null)}
                variant="secondary"
                size="icon"
                className="absolute end-2 top-2 size-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
