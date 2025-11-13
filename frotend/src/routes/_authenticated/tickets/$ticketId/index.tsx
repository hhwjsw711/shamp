import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Calendar, History, MapPin, MessageSquare, Pencil, Tag, Trash2, TriangleAlert, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { api as convexApi } from '@/lib/convex-api'
import { usePageHeaderCTAs } from '@/components/layout/page-header-ctas'
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

function getStatusLabel(status: string) {
  switch (status) {
    case 'analyzing':
      return 'Analyzing'
    case 'analyzed':
      return 'Analyzed'
    case 'reviewed':
      return 'Reviewed'
    case 'processing':
      return 'Processing'
    case 'quotes_available':
      return 'Quotes Available'
    case 'quote_selected':
      return 'Quote Selected'
    case 'fixed':
      return 'Fixed'
    case 'closed':
      return 'Closed'
    default:
      return status
  }
}

function getStatusStyles(status: string) {
  switch (status) {
    case 'analyzing':
      return 'bg-gray-100 text-gray-700 border-gray-200'
    case 'analyzed':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'reviewed':
      return 'bg-purple-100 text-purple-700 border-purple-200'
    case 'processing':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'quotes_available':
      return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'quote_selected':
      return 'bg-indigo-100 text-indigo-700 border-indigo-200'
    case 'fixed':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'closed':
      return 'bg-gray-100 text-gray-700 border-gray-200'
    default:
      return ''
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
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const { setCTAs } = usePageHeaderCTAs()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<'details' | 'vendors' | 'conversations'>('details')
  const [isMobile, setIsMobile] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDiscoveryLog, setShowDiscoveryLog] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isMarkingAsReviewed, setIsMarkingAsReviewed] = useState(false)

  // Mutations and Actions
  const markAsReviewed = useMutation(convexApi.functions.tickets.mutations.markAsReviewed)
  const deleteTicket = useMutation(convexApi.functions.tickets.mutations.deleteTicket)
  const discoverVendors = useAction(convexApi.functions.agents.vendorDiscoveryAction.discoverVendors)

  // Use Convex query for real-time ticket data
  const ticketResult = useQuery(
    convexApi.functions.tickets.queries.getById,
    user?.id && isAuthenticated && ticketId
      ? { ticketId: ticketId as any, userId: user.id as any }
      : 'skip'
  )

  // Fetch discovery logs from database
  const discoveryLogsResult = useQuery(
    convexApi.functions.discoveryLogs.queries.getByTicketId,
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

  // Handle loading and error states
  const isLoading = ticketResult === undefined && isAuthenticated
  const ticket = ticketResult || null
  const conversation = conversationResult || null

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

  // Auto-scroll discovery log to bottom when new logs arrive
  useEffect(() => {
    if (showDiscoveryLog && discoveryLogsResult?.logs && discoveryLogsResult.logs.length > 0) {
      const logContainer = document.querySelector('[data-discovery-log]')
      if (logContainer) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          logContainer.scrollTop = logContainer.scrollHeight
        }, 100)
      }
    }
  }, [discoveryLogsResult?.logs, showDiscoveryLog])

  // Check if processing is complete based on logs and ticket status
  useEffect(() => {
    if (discoveryLogsResult?.logs) {
      const hasComplete = discoveryLogsResult.logs.some(log => log.type === 'complete')
      const hasError = discoveryLogsResult.logs.some(log => log.type === 'error')
      
      // If we have complete or error logs, processing is done
      if (hasComplete || hasError) {
        setIsProcessing(false)
        if (hasComplete) {
          toast.success('Vendor Discovery Complete', {
            description: 'Vendors have been discovered and saved.',
            duration: 4000,
          })
        }
      }
    }
    
    // Also check ticket status - if status is "processing", we're still processing
    // This ensures the indicator shows even after page reload
    if (ticket && (ticket.status as string) === 'processing') {
      // Check if we have completion logs - if not, still processing
      const logs = discoveryLogsResult?.logs
      const hasComplete = logs ? logs.some(log => log.type === 'complete') : false
      const hasError = logs ? logs.some(log => log.type === 'error') : false
      
      if (!hasComplete && !hasError) {
        setIsProcessing(true)
      }
    } else if (ticket && (ticket.status as string) !== 'processing' && isProcessing) {
      // If status is no longer "processing", stop the indicator
      setIsProcessing(false)
    }
  }, [discoveryLogsResult?.logs, ticket?.status, isProcessing])

  // Set up page header CTAs
  useEffect(() => {
    if (!ticket || !user) {
      setCTAs(null)
      return
    }

    const editableStatuses = ['analyzed', 'reviewed']
    const canEdit = editableStatuses.includes(ticket.status)
    const canDelete = ['analyzed', 'reviewed', 'fixed', 'closed'].includes(ticket.status)
    const canMarkAsReviewed = ticket.status === 'analyzed'
    const canProcessTicket = ticket.status === 'reviewed'

    const ctas = (
      <section className="flex items-center gap-2">
        {canMarkAsReviewed && (
          <Button
            variant="default-glass"
            size="sm"
            disabled={isMarkingAsReviewed}
            onClick={async () => {
              if (!user.id || isMarkingAsReviewed) return
              setIsMarkingAsReviewed(true)
              try {
                await markAsReviewed({ 
                  ticketId: ticketId as any,
                  userId: user.id as any,
                })
                toast.success('Ticket Marked as Reviewed', {
                  description: 'The ticket has been successfully marked as reviewed.',
                  duration: 3000,
                })
              } catch (error) {
                toast.error('Failed to Mark as Reviewed', {
                  description: error instanceof Error ? error.message : 'An error occurred.',
                  duration: 5000,
                })
              } finally {
                setIsMarkingAsReviewed(false)
              }
            }}
          >
            {isMarkingAsReviewed ? (
              <>
                <Spinner className="size-4" />
                Marking...
              </>
            ) : (
              'Mark As Reviewed'
            )}
          </Button>
        )}
        {canProcessTicket && (
          <Button
            variant="default-glass"
            size="sm"
            disabled={isProcessing}
            onClick={async () => {
              if (!user.id || isProcessing) return
              
              setIsProcessing(true)
              setShowDiscoveryLog(true)
              
              try {
                // Call Convex action - it runs independently and saves logs to database
                // The Convex query will automatically update when logs are saved
                await discoverVendors({
                  ticketId: ticketId as any,
                  userId: user.id as any,
                })
                
                // Note: Processing completion is detected via the useEffect that watches discoveryLogsResult
                // The action runs independently, so we don't wait for it to complete here
              } catch (error) {
                setIsProcessing(false)
                toast.error('Failed to Process Ticket', {
                  description: error instanceof Error ? error.message : 'An error occurred while processing the ticket.',
                  duration: 5000,
                })
              }
            }}
          >
            {isProcessing ? (
              <>
                <Spinner className="size-4" />
                Processing...
              </>
            ) : (
              'Process Ticket'
            )}
          </Button>
        )}
        {canEdit && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate({ to: `/tickets/${ticketId}/edit` })}
            aria-label="Edit ticket"
          >
            <Pencil className="size-4" />
          </Button>
        )}
        {canDelete && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowDeleteDialog(true)}
            aria-label="Delete ticket"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </section>
    )

    setCTAs(ctas)

    // Cleanup: clear CTAs when component unmounts or ticket changes
    return () => {
      setCTAs(null)
    }
  }, [ticketResult, user, ticketId, markAsReviewed, navigate, setCTAs, isMarkingAsReviewed, isProcessing, discoverVendors])

  const handleDeleteTicket = async () => {
    if (!ticket || !user?.id) return

    try {
      await deleteTicket({
        ticketId: ticketId as any,
        userId: user.id as any,
      })

      toast.success('Ticket Deleted', {
        description: 'The ticket has been successfully deleted.',
        duration: 3000,
      })

      setShowDeleteDialog(false)
      navigate({ to: '/tickets' })
    } catch (error) {
      toast.error('Failed to Delete Ticket', {
        description: error instanceof Error ? error.message : 'An error occurred while deleting the ticket.',
        duration: 5000,
      })
    }
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
      <header className="p-4 shrink-0 flex flex-row items-center justify-between">
        <h2 className="font-semibold text-sm">Ticket Details</h2>
        <Badge
          variant="outline"
          className={`text-xs px-2 py-1 ${getStatusStyles(ticket.status)}`}
        >
          {getStatusLabel(ticket.status)}
        </Badge>
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

  // Render Discovery Log Section
  const renderDiscoveryLog = () => (
    <section className="flex flex-col w-full md:flex-1 md:min-w-96 bg-background rounded-3xl min-h-0">
      {/* Header */}
      <header className="p-4 shrink-0 flex flex-row items-center justify-between">
        <section className="flex items-center gap-2">
          <History className="size-4" />
          <h2 className="font-semibold text-sm">Discovery Log</h2>
        </section>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowDiscoveryLog(false)}
          aria-label="Close discovery log"
        >
          <X className="size-4" />
        </Button>
      </header>

      {/* Scrollable Content */}
      <section 
        data-discovery-log
        className="flex-1 overflow-y-auto p-4 min-h-0"
      >
        {!discoveryLogsResult?.logs || discoveryLogsResult.logs.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyTitle>No discovery activity</EmptyTitle>
              <EmptyDescription>Click "Process Ticket" to start vendor discovery.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <section className="space-y-2">
            {discoveryLogsResult.logs.map((log) => (
              <motion.section
                key={log._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`p-3 rounded-lg transition-all ${
                  log.type === 'error'
                    ? 'bg-red-50/50 border border-red-200/50'
                    : log.type === 'complete'
                    ? 'bg-green-50/50 border border-green-200/50'
                    : log.type === 'vendor_found'
                    ? 'bg-blue-50/50 border border-blue-200/50'
                    : log.type === 'tool_call'
                    ? 'bg-purple-50/50 border border-purple-200/50'
                    : 'bg-zinc-50/50 border border-zinc-200/50'
                }`}
              >
                {log.type === 'status' && (
                  <p className="text-sm text-foreground leading-relaxed">{log.message}</p>
                )}
                {log.type === 'tool_call' && (
                  <section className="space-y-1.5">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Tool Call</p>
                    <p className="text-sm text-foreground leading-relaxed">
                      <span className="font-medium text-purple-900">{log.toolName}</span>
                      {log.message && (
                        <span className="text-muted-foreground">: {log.message}</span>
                      )}
                    </p>
                  </section>
                )}
                {log.type === 'tool_result' && (
                  <section className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tool Result</p>
                    <p className="text-sm text-foreground leading-relaxed">
                      <span className="font-medium">{log.toolName}</span> completed successfully
                    </p>
                  </section>
                )}
                {log.type === 'vendor_found' && log.vendor && (
                  <section className="space-y-2">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Vendor Found</p>
                    <p className="text-sm font-semibold text-foreground">{log.vendor.businessName}</p>
                    {log.vendor.specialty && (
                      <p className="text-xs text-muted-foreground">Specialty: {log.vendor.specialty}</p>
                    )}
                    {log.vendor.address && (
                      <p className="text-xs text-muted-foreground">📍 {log.vendor.address}</p>
                    )}
                    {log.vendor.rating && (
                      <p className="text-xs text-muted-foreground">⭐ Rating: {log.vendor.rating}/5</p>
                    )}
                  </section>
                )}
                {log.type === 'step' && (
                  <section className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Step {log.stepNumber}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{log.message}</p>
                  </section>
                )}
                {log.type === 'complete' && (
                  <section className="space-y-1.5">
                    <p className="text-sm font-semibold text-green-700 flex items-center gap-2">
                      <span>✓</span>
                      <span>Discovery Complete</span>
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{log.message}</p>
                  </section>
                )}
                {log.type === 'error' && (
                  <section className="space-y-1.5">
                    <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                      <span>✗</span>
                      <span>Error</span>
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{log.error}</p>
                  </section>
                )}
              </motion.section>
            ))}
            {isProcessing && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-zinc-50/50 border border-zinc-200/50"
              >
                <Spinner className="size-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Processing...</p>
              </motion.section>
            )}
          </section>
        )}
      </section>
    </section>
  )

  // Render Vendors Section
  const renderVendors = () => (
    <section className="flex flex-col w-full md:flex-1 md:min-w-96 bg-background rounded-3xl min-h-0">
      {/* Header */}
      <header className="p-4 shrink-0 flex flex-row items-center justify-between">
        <section className="flex items-center gap-2">
          <Users className="size-4" />
          <h2 className="font-semibold text-sm">Vendors</h2>
          <Badge variant="secondary">{vendorQuotes.length}</Badge>
        </section>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowDiscoveryLog(true)}
          aria-label="View discovery log"
        >
          <History className="size-4" />
        </Button>
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
              {showDiscoveryLog ? 'Discovery Log' : `Vendors (${vendorQuotes.length})`}
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

          {/* Vendors / Discovery Log */}
          <section className={isMobile && selectedTab !== 'vendors' ? 'hidden' : 'flex flex-col h-full flex-1 min-w-0'}>
            <AnimatePresence mode="wait">
              {showDiscoveryLog ? (
                <motion.div
                  key="discovery-log"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="flex flex-col h-full w-full flex-1 min-w-0"
                >
                  {renderDiscoveryLog()}
                </motion.div>
              ) : (
                <motion.div
                  key="vendors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="flex flex-col h-full w-full flex-1 min-w-0"
                >
                  {renderVendors()}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Conversations */}
          <section className={isMobile && selectedTab !== 'conversations' ? 'hidden' : 'flex'}>
            {renderConversations()}
          </section>
        </section>
      </section>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this ticket</DialogTitle>
            <DialogDescription>
              {ticket.ticketName
                ? `Deleting "${ticket.ticketName}" means all associated data including photos, vendor quotes, and conversation history will be permanently removed. This action cannot be undone.`
                : 'Deleting this ticket means all associated data including photos, vendor quotes, and conversation history will be permanently removed. This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-start gap-4">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteTicket}
            >
              Delete ticket
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
