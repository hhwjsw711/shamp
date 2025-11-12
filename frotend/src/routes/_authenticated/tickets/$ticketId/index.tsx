import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Calendar, MapPin, MessageSquare, Tag, TriangleAlert, Users, X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { api as convexApi } from '@/lib/convex-api'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

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
  const [selectedTab, setSelectedTab] = useState<'details' | 'vendors' | 'conversations'>('details')
  const [isMobile, setIsMobile] = useState(false)

  // Use Convex query for real-time ticket data
  const ticketResult = useQuery(
    convexApi.functions.tickets.queries.getById,
    user?.id && isAuthenticated && ticketId
      ? { ticketId: ticketId as any, userId: user.id as any }
      : 'skip'
  )

  // Fetch vendor quotes for this ticket
  const vendorQuotesResult = useQuery(
    convexApi.functions.vendorQuotes.queries.getByTicketId,
    user?.id && isAuthenticated && ticketId
      ? { ticketId: ticketId as any, userId: user.id as any }
      : 'skip'
  )

  // Fetch vendors for each quote
  const vendorQuotes = vendorQuotesResult?.quotes || []
  const vendorIds = [...new Set(vendorQuotes.map(q => q.vendorId))]
  
  // Fetch vendor details for each unique vendor ID
  const vendorsResult = useQuery(
    convexApi.functions.vendors.queries.list,
    user?.id && isAuthenticated && vendorIds.length > 0
      ? { userId: user.id as any }
      : 'skip'
  )
  
  // Create a map of vendorId to vendor details
  const vendorsMap = new Map()
  if (vendorsResult) {
    vendorsResult.forEach(vendor => {
      vendorsMap.set(vendor._id, vendor)
    })
  }

  // Fetch conversation for this ticket
  const conversationResult = useQuery(
    convexApi.functions.conversations.queries.getByTicketId,
    user?.id && isAuthenticated && ticketId
      ? { ticketId: ticketId as any, userId: user.id as any }
      : 'skip'
  )

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Reset selected tab to 'details' when switching from mobile to desktop
  useEffect(() => {
    if (!isMobile && selectedTab !== 'details') {
      setSelectedTab('details')
    }
  }, [isMobile, selectedTab])

  // Handle loading and error states
  const isLoading = ticketResult === undefined && isAuthenticated
  const ticket = ticketResult || null
  const conversation = conversationResult || null

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

  // Filter out null/undefined photoUrls
  const validPhotoUrls = ticket.photoUrls.filter((url): url is string => Boolean(url))

  // Render Ticket Details Section
  const renderTicketDetails = () => (
    <section className="flex flex-col w-full md:w-80 md:min-w-80 shrink-0 bg-background rounded-3xl">
      {/* Header */}
      <header className="p-4 shrink-0">
        <h2 className="font-semibold text-sm">Ticket Details</h2>
      </header>

      {/* Scrollable Content */}
      <section className="flex-1 overflow-y-auto p-2 min-h-0">
        <section className="flex flex-col gap-2">
        {/* Images Section */}
        {validPhotoUrls.length > 0 && (
          <section className="bg-zinc-100 rounded-2xl p-4">
            <h3 className="text-xs font-normal text-muted-foreground/70 mb-3 uppercase tracking-wide">Photos</h3>
            <section className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {validPhotoUrls.map((url, index) => (
                <section
                  key={index}
                  className="group relative flex-none w-20 h-20 cursor-pointer"
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

        {/* Description */}
        <section className="bg-zinc-100 rounded-2xl p-4">
          <h3 className="text-xs font-normal text-muted-foreground/70 mb-2 uppercase tracking-wide">Description</h3>
          <p className="text-base font-medium text-foreground whitespace-pre-wrap">{ticket.description || 'No description provided'}</p>
        </section>

        {/* Problem Description */}
        {ticket.problemDescription && (
          <section className="bg-zinc-100 rounded-2xl p-4">
            <h3 className="text-xs font-normal text-muted-foreground/70 mb-2 uppercase tracking-wide">Problem Analysis</h3>
            <p className="text-base font-medium text-foreground whitespace-pre-wrap">{ticket.problemDescription}</p>
          </section>
        )}

        {/* Issue Type */}
        {ticket.issueType && (
          <section className="bg-zinc-100 rounded-2xl p-4">
            <h3 className="text-xs font-normal text-muted-foreground/70 mb-2 flex items-center gap-2 uppercase tracking-wide">
              <Tag className="size-3" />
              Issue Type
            </h3>
            <Badge variant="outline" className="text-sm px-2 py-1">
              {ticket.issueType}
            </Badge>
          </section>
        )}

        {/* Urgency */}
        <section className="bg-zinc-100 rounded-2xl p-4">
          <h3 className="text-xs font-normal text-muted-foreground/70 mb-2 uppercase tracking-wide">Urgency</h3>
          <Badge
            variant="outline"
            className={`text-sm px-2 py-1 ${getUrgencyStyles(ticket.urgency)}`}
          >
            {getUrgencyLabel(ticket.urgency)}
          </Badge>
        </section>

        {/* Location */}
        {ticket.location && (
          <section className="bg-zinc-100 rounded-2xl p-4">
            <h3 className="text-xs font-normal text-muted-foreground/70 mb-2 flex items-center gap-2 uppercase tracking-wide">
              <MapPin className="size-3" />
              Location
            </h3>
            <p className="text-base font-medium text-foreground">{ticket.location}</p>
          </section>
        )}

        {/* Date */}
        <section className="bg-zinc-100 rounded-2xl p-4">
          <h3 className="text-xs font-normal text-muted-foreground/70 mb-2 flex items-center gap-2 uppercase tracking-wide">
            <Calendar className="size-3" />
            Created Date
          </h3>
          <p className="text-base font-medium text-foreground">{formatDate(ticket.createdAt)}</p>
        </section>
        </section>
      </section>
    </section>
  )

  // Render Vendors Section
  const renderVendors = () => (
    <section className="flex flex-col w-full md:flex-1 md:min-w-96 bg-background rounded-3xl">
      {/* Header */}
      <header className="p-4 shrink-0">
        <section className="flex items-center justify-between">
          <section className="flex items-center gap-2">
            <Users className="size-4" />
            <h2 className="font-semibold text-sm">Vendors</h2>
            <Badge variant="secondary">{vendorQuotes.length}</Badge>
          </section>
        </section>
      </header>

      {/* Scrollable Content */}
      <section className="flex-1 overflow-y-auto p-4 min-h-0">
        {vendorQuotes.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>No vendors</EmptyTitle>
              <EmptyDescription>No vendors have been contacted for this ticket yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <section className="space-y-4">
            {vendorQuotes.map((quote) => {
              const vendor = vendorsMap.get(quote.vendorId)
              const vendorName = vendor?.businessName || 'Unknown Vendor'
              const priceInDollars = quote.price / 100 // Convert from cents to dollars
              
              return (
                <section key={quote._id} className="p-4 border rounded-lg">
                  <section className="space-y-2">
                    <section className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{vendorName}</h4>
                      <Badge variant="outline" className="text-xs">
                        {quote.status}
                      </Badge>
                    </section>
                    <section className="flex items-center gap-2">
                      <p className="text-sm font-semibold">
                        {quote.currency} ${priceInDollars.toFixed(2)}
                      </p>
                      {quote.estimatedDeliveryTime && (
                        <span className="text-xs text-muted-foreground">
                          • {quote.estimatedDeliveryTime}h
                        </span>
                      )}
                    </section>
                    {quote.responseText && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {quote.responseText}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDate(quote.createdAt)}
                    </p>
                  </section>
                </section>
              )
            })}
          </section>
        )}
      </section>
    </section>
  )

  // Render Conversations Section
  const renderConversations = () => (
    <section className="flex flex-col w-full md:w-80 md:min-w-80 shrink-0 bg-background rounded-3xl">
      {/* Header */}
      <header className="p-4 shrink-0">
        <section className="flex items-center gap-2">
          <MessageSquare className="size-4" />
          <h2 className="font-semibold text-sm">Conversations</h2>
          {conversation && (
            <Badge variant="secondary">{conversation.messages.length}</Badge>
          )}
        </section>
      </header>

      {/* Scrollable Content */}
      <section className="flex-1 overflow-y-auto p-4 min-h-0">
        {!conversation || conversation.messages.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquare />
              </EmptyMedia>
              <EmptyTitle>No messages</EmptyTitle>
              <EmptyDescription>No conversations for this ticket yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <section className="space-y-4">
            {conversation.messages.map((message, index) => (
              <section
                key={index}
                className={`p-3 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-primary/10 ml-auto max-w-[80%]'
                    : message.sender === 'agent'
                    ? 'bg-muted mr-auto max-w-[80%]'
                    : 'bg-secondary/50 mr-auto max-w-[80%]'
                }`}
              >
                <section className="flex items-center gap-2 mb-1">
                  <section className="text-xs font-medium capitalize">{message.sender}</section>
                  <section className="text-xs text-muted-foreground">
                    {formatDate(message.date)}
                  </section>
                </section>
                <p className="text-sm">{message.message}</p>
              </section>
            ))}
          </section>
        )}
      </section>
    </section>
  )

  return (
    <main className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Tabs Section - Mobile Only (< md) */}
      <section className="md:hidden w-full border-b p-4 shrink-0">
        <Tabs
          value={selectedTab}
          onValueChange={(value) => setSelectedTab(value as typeof selectedTab)}
        >
          <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide">
            <TabsTrigger value="details" className="shrink-0">
              Details
            </TabsTrigger>
            <TabsTrigger value="vendors" className="shrink-0">
              Vendors ({vendorQuotes.length})
            </TabsTrigger>
            <TabsTrigger value="conversations" className="shrink-0">
              Conversations ({conversation?.messages.length || 0})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </section>

      {/* Content Section */}
      <section className="flex-1 overflow-hidden min-h-0">
        <section className="flex flex-row gap-4 h-full px-4 py-4 w-full">
          {/* Ticket Details */}
          <section className={isMobile && selectedTab !== 'details' ? 'hidden' : 'flex'}>
            {renderTicketDetails()}
          </section>

          {/* Vendors */}
          <section className={isMobile && selectedTab !== 'vendors' ? 'hidden' : 'flex'}>
            {renderVendors()}
          </section>

          {/* Conversations */}
          <section className={isMobile && selectedTab !== 'conversations' ? 'hidden' : 'flex'}>
            {renderConversations()}
          </section>
        </section>
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
    </main>
  )
}
