import * as React from 'react'
import { Badge } from '@/components/ui/badge'

interface TicketStatusColumnProps {
  title: string
  count: number
  children: React.ReactNode
  isSelected?: boolean
  className?: string
}

export function TicketStatusColumn({
  title,
  count,
  children,
  isSelected = true,
  className = ''
}: TicketStatusColumnProps) {
  return (
    <section
      className={`flex flex-col w-80 shrink-0 bg-background rounded-3xl ${
        !isSelected ? 'hidden md:flex' : 'flex'
      } ${className}`}
    >
      {/* Column Header */}
      <header className="p-4 shrink-0">
        <section className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">{title}</h2>
          <Badge variant="secondary" className="ml-2">
            {count}
          </Badge>
        </section>
      </header>

      {/* Column Content - Scrollable */}
      <section className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-0">
        {count === 0 ? (
          <section className="text-center text-muted-foreground text-sm py-8">
            No tickets
          </section>
        ) : (
          children
        )}
      </section>
    </section>
  )
}