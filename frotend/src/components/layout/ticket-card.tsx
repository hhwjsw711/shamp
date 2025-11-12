import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Calendar, Edit, MapPin, Tag, Trash2, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TicketCardProps {
  title: string
  description?: string
  problemDescription?: string
  ticketName?: string
  photoUrls?: Array<string | null>
  urgency?: 'emergency' | 'urgent' | 'normal' | 'low'
  location?: string
  date: string
  issueType?: string
  status?: 'analyzing' | 'analyzed' | 'reviewed' | 'processing' | 'quotes_available' | 'scheduled' | 'fixed' | 'closed'
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

function getUrgencyStyles(urgency?: string) {
  switch (urgency) {
    case 'emergency':
      return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
    case 'urgent':
      return 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200'
    case 'normal':
      return 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
    case 'low':
      return 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
    default:
      return ''
  }
}

export function TicketCard({
  title,
  description,
  problemDescription,
  ticketName,
  photoUrls = [],
  urgency,
  location,
  date,
  issueType,
  status,
  onClick,
  onEdit,
  onDelete,
  className = ''
}: TicketCardProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  // Use problemDescription if available, otherwise fall back to description
  const displayText = problemDescription || description || ''
  
  // Filter out null/undefined photoUrls
  const validPhotoUrls = photoUrls.filter((url): url is string => Boolean(url))

  // Determine which buttons to show based on status
  // Can edit/delete: analyzed, reviewed
  // Can edit only (no delete): processing, quotes_available, scheduled
  // Can only delete (no edit): fixed, closed
  const canEdit = status && ['analyzed', 'reviewed'].includes(status)
  const canDelete = status && ['analyzed', 'reviewed', 'fixed', 'closed'].includes(status)
  const showButtons = (canEdit && onEdit) || (canDelete && onDelete)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = () => {
    setShowDeleteDialog(false)
    onDelete?.()
  }

  return (
    <>
      <Card 
        className={`group relative bg-zinc-100 rounded-2xl border-0 shadow-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
      >
        {/* Action Buttons - Top Right */}
        {showButtons && (
          <ButtonGroup
            className="absolute bg-background px-2 py-1 flex items-center gap-2 rounded-xl end-2 top-2 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            {canEdit && onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
                className="size-7 cursor-pointer"
                aria-label="Edit ticket"
              >
                <Edit className="size-4" />
              </Button>
            )}
            {canDelete && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleDeleteClick}
                className="size-7 text-destructive hover:text-destructive cursor-pointer"
                aria-label="Delete ticket"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </ButtonGroup>
        )}
        {/* Images Section - Full Width at Top */}
        {validPhotoUrls.length > 0 && (
          <section className="w-full px-6 pt-6">
            <section className="flex gap-2 overflow-x-auto scrollbar-hide pb-3">
              {validPhotoUrls.map((url, index) => (
                <section key={index} className="relative flex-none w-16 h-16 overflow-hidden rounded-lg cursor-pointer hover:opacity-80 transition-opacity">
                  <img
                    src={url}
                    alt={`Ticket photo ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImage(url)
                    }}
                  />
                </section>
              ))}
            </section>
          </section>
        )}

        <CardHeader className={`pb-3 ${validPhotoUrls.length > 0 ? 'pt-0' : ''}`}>
          <section className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium line-clamp-2">
              {status === 'analyzing' 
                ? 'Awaiting ticket name' 
                : ticketName || title}
            </CardTitle>
            {urgency && (
              <Badge className={`shrink-0 ${getUrgencyStyles(urgency)}`}>
                {urgency}
              </Badge>
            )}
          </section>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {/* Description/Problem Description */}
          {displayText && (
            <CardDescription className="text-xs line-clamp-2">
              {displayText}
            </CardDescription>
          )}

          {/* Date and Location Section */}
          <section className="flex items-center gap-4 text-xs">
            {/* Location */}
            {location && (
              <div className="flex items-center gap-1">
                <MapPin className="size-3 text-muted-foreground" />
                <span className="text-muted-foreground">{location}</span>
              </div>
            )}
            
            {/* Date */}
            <div className="flex items-center gap-1">
              <Calendar className="size-3 text-muted-foreground" />
              <span className="text-muted-foreground">{date}</span>
            </div>
          </section>

          {/* Issue Type Section */}
          {issueType && (
            <section className="flex justify-start">
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Tag className="size-3" />
                {issueType}
              </Badge>
            </section>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this ticket</DialogTitle>
            <DialogDescription>
              {ticketName 
                ? `Deleting "${ticketName}" means all associated data including photos, vendor quotes, and conversation history will be permanently removed. This action cannot be undone.`
                : 'Deleting this ticket means all associated data including photos, vendor quotes, and conversation history will be permanently removed. This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-start gap-4">
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
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
    </>
  )
}