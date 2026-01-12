import * as React from 'react'
import { ArrowUpDown, ClipboardList, Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

interface TicketStatusColumnProps {
  title: string
  count: number
  children: React.ReactNode
  isSelected?: boolean
  className?: string
  searchQuery?: string
  onSearchChange?: (query: string) => void
  sortBy?: 'date' | 'urgency'
  onSortChange?: (sortBy: 'date' | 'urgency') => void
}

export function TicketStatusColumn({
  title,
  count,
  children,
  isSelected = true,
  className = '',
  searchQuery = '',
  onSearchChange,
  sortBy = 'date',
  onSortChange,
}: TicketStatusColumnProps) {
  const { t } = useTranslation()
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchOpen])

  const handleSearchChange = (value: string) => {
    onSearchChange?.(value)
  }

  const handleCloseSearch = () => {
    setIsSearchOpen(false)
    onSearchChange?.('')
  }

  return (
    <section
      className={`flex flex-col w-full md:w-80 shrink-0 bg-background rounded-3xl ${
        !isSelected ? 'hidden md:flex' : 'flex'
      } ${className}`}
    >
      {/* Column Header */}
      <header className="p-4 shrink-0">
        <AnimatePresence mode="wait">
          {isSearchOpen ? (
            /* Search Mode */
            <motion.div
              key="search-mode"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="flex items-center gap-2"
            >
              <motion.div
                className="flex-1 relative"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4 pointer-events-none z-10" />
                <Input
                  ref={searchInputRef}
                  placeholder={t($ => $.tickets.list.searchPlaceholder).replace('{status}', title.toLowerCase())}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10! h-8 text-sm"
                  autoFocus
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: 0.15 }}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCloseSearch}
                  className="shrink-0"
                  aria-label={t($ => $.common.ariaLabels.closeSearch)}
                >
                  <X className="size-4" />
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            /* Normal Mode */
            <motion.div
              key="normal-mode"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="flex items-center justify-between"
            >
              <motion.div 
                className="flex items-center gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
          <h2 className="font-semibold text-sm">{title}</h2>
                <Badge variant="secondary">
            {count}
          </Badge>
              </motion.div>
              <motion.div 
                className="flex items-center gap-2"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSearchOpen(true)}
                  className="size-8"
                >
                  <Search className="size-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      aria-label={t($ => $.common.ariaLabels.sortTickets)}
                    >
                      <ArrowUpDown className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => onSortChange?.('date')}
                      className={sortBy === 'date' ? 'bg-accent' : ''}
                    >
                      {t($ => $.tickets.list.sortByDate)}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onSortChange?.('urgency')}
                      className={sortBy === 'urgency' ? 'bg-accent' : ''}
                    >
                      {t($ => $.tickets.list.sortByUrgency)}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Column Content - Scrollable */}
      <section className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-0">
        {count === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardList />
              </EmptyMedia>
              <EmptyTitle>
                {searchQuery ? t($ => $.tickets.list.noMatchesFound) : t($ => $.tickets.list.noTicketsInColumn)}
              </EmptyTitle>
              <EmptyDescription>
                {searchQuery
                  ? t($ => $.tickets.list.noMatchesDescription).replace('{query}', searchQuery)
                  : t($ => $.tickets.list.noTicketsInColumnDescription)}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          children
        )}
      </section>
    </section>
  )
}