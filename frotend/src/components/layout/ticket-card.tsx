import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TicketCardProps {
  title: string
  urgency?: 'emergency' | 'urgent' | 'normal' | 'low'
  location?: string
  date: string
  photoCount?: number
  issueType?: string
  onClick?: () => void
  className?: string
}

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

export function TicketCard({
  title,
  urgency,
  location,
  date,
  photoCount = 0,
  issueType,
  onClick,
  className = ''
}: TicketCardProps) {
  return (
    <Card 
      className={`bg-zinc-100 rounded-2xl border-0 shadow-none cursor-pointer ${className}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium line-clamp-2">
            {title}
          </CardTitle>
          {urgency && (
            <Badge variant={getUrgencyColor(urgency) as any} className="shrink-0">
              {urgency}
            </Badge>
          )}
        </div>
        {location && (
          <CardDescription className="text-xs mt-1">{location}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{date}</span>
          {photoCount > 0 && (
            <span className="flex items-center gap-1">
              📷 {photoCount}
            </span>
          )}
        </div>
        {issueType && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              {issueType}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}