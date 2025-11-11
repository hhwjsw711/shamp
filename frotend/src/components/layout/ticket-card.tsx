import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TicketCardProps {
  title: string
  description?: string
  problemDescription?: string
  photoUrls?: Array<string | null>
  urgency?: 'emergency' | 'urgent' | 'normal' | 'low'
  location?: string
  date: string
  issueType?: string
  onClick?: () => void
  className?: string
}

function getUrgencyColor(urgency?: string) {
  switch (urgency) {
    case 'emergency':
      return 'destructive' // red
    case 'urgent':
      return 'destructive' // orange - we'll use custom styling
    case 'normal':
      return 'default' // blue - we'll use custom styling  
    case 'low':
      return 'secondary' // gray
    default:
      return 'outline'
  }
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
      return 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
    default:
      return ''
  }
}

export function TicketCard({
  title,
  description,
  problemDescription,
  photoUrls = [],
  urgency,
  location,
  date,
  issueType,
  onClick,
  className = ''
}: TicketCardProps) {
  // Use problemDescription if available, otherwise fall back to description
  const displayText = problemDescription || description || ''
  
  // Filter out null/undefined photoUrls
  const validPhotoUrls = photoUrls.filter((url): url is string => Boolean(url))

  return (
    <Card 
      className={`bg-zinc-100 rounded-2xl border-0 shadow-none cursor-pointer ${className}`}
      onClick={onClick}
    >
      {/* Images Section - Full Width at Top */}
      {validPhotoUrls.length > 0 && (
        <section className="w-full px-6 pt-6">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3">
            {validPhotoUrls.map((url, index) => (
              <div key={index} className="relative flex-none w-16 h-16 overflow-hidden rounded-lg">
                <img
                  src={url}
                  alt={`Ticket photo ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <CardHeader className={`pb-3 ${validPhotoUrls.length > 0 ? 'pt-0' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium line-clamp-2">
            {title}
          </CardTitle>
          {urgency && (
            <Badge className={`shrink-0 ${getUrgencyStyles(urgency)}`}>
              {urgency}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Description/Problem Description */}
        {displayText && (
          <CardDescription className="text-xs line-clamp-2">
            {displayText}
          </CardDescription>
        )}

        {/* Location, Date and Issue Type Section */}
        <section className="flex items-center justify-between gap-2 text-xs">
          {/* Left: Location */}
          <div className="flex-none">
            {location && (
              <span className="text-muted-foreground">{location}</span>
            )}
          </div>
          
          {/* Center: Date */}
          <div className="flex-1 text-center">
            <span className="text-muted-foreground">{date}</span>
          </div>
          
          {/* Right: Issue Type */}
          <div className="flex-none">
            {issueType && (
              <Badge variant="outline" className="text-xs">
                {issueType}
              </Badge>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}