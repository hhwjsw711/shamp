import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Building2Icon, ChevronRightIcon, HelpCircleIcon, HomeIcon, LogOutIcon, MessageSquareIcon, PlusIcon, SettingsIcon, TicketIcon } from 'lucide-react'
import * as React from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Sidebar as SidebarPrimitive,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const menuItems = [
  {
    title: 'Home',
    icon: HomeIcon,
    href: '/',
  },
  {
    title: 'Tickets',
    icon: TicketIcon,
    href: '/tickets',
  },
  {
    title: 'Vendors',
    icon: Building2Icon,
    href: '/vendors',
  },
  {
    title: 'Conversations',
    icon: MessageSquareIcon,
    href: '/conversations',
  },
]

function SidebarContentComponent() {
  const location = useLocation()
  const navigate = useNavigate()
  const { state, setOpen } = useSidebar()
  const [isHovered, setIsHovered] = React.useState(false)
  
  // Hide Create New Ticket button when on the create or edit ticket page
  const isOnCreateTicketPage = location.pathname === '/tickets/create'
  const isOnEditTicketPage = location.pathname.match(/^\/tickets\/[^/]+\/edit$/)
  const shouldHideCreateButton = isOnCreateTicketPage || isOnEditTicketPage

  const handleSidebarClick = (e: React.MouseEvent) => {
    // Only expand if sidebar is collapsed and not clicking on interactive elements
    if (state === "collapsed") {
      const target = e.target as HTMLElement
      const isInteractiveElement = target.closest('button, a, [role="button"], [tabindex]')
      
      if (!isInteractiveElement) {
        setOpen(true)
      }
    }
  }

  return (
    <section 
      className={cn(
        "flex flex-col gap-4 bg-background h-full",
        state === "collapsed" && "cursor-ew-resize"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleSidebarClick}
    >
      <SidebarHeader className={cn(
        "w-full flex items-center px-4 pt-4",
        state === "collapsed" ? "justify-center" : "justify-between"
      )}>
        <section className="relative w-full flex justify-center items-center">
          {/* Favicon - shows when expanded or when collapsed and not hovering */}
          <img
            src="/shamp-favicon.png"
            alt="Shamp Logo"
            className={cn(
              "h-6 w-auto transition-opacity duration-200 object-contain",
              state === "expanded" && "mr-auto",
              state === "collapsed" && isHovered && "opacity-0",
              state === "collapsed" && !isHovered && "opacity-100"
            )}
          />
          {/* SidebarTrigger - shows when expanded or when collapsed and hovering */}
          <SidebarTrigger
            className={cn(
              "transition-opacity duration-200",
              state === "expanded" && "ml-auto",
              state === "collapsed" && isHovered && "opacity-100 absolute",
              state === "collapsed" && !isHovered && "opacity-0 absolute"
            )}
          />
        </section>
      </SidebarHeader>

      <SidebarContent className={cn(
        "px-4 gap-4",
        state === "collapsed" && "overflow-visible flex flex-col items-center"
      )}>
        {/* Create New Ticket Button Group - Hide when on create or edit ticket page */}
        {!shouldHideCreateButton && (
          <SidebarGroup className="p-0">
            <SidebarGroupContent className={cn(
              state === "collapsed" && "flex justify-center"
            )}>
              {state === "collapsed" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default-glass"
                      size="icon"
                      className="w-10 h-10 min-w-10 min-h-10 rounded-full flex items-center justify-center p-0"
                      onClick={() => navigate({ to: '/tickets/create' })}
                    >
                      <PlusIcon className="size-5 shrink-0" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Create New Ticket</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="default-glass"
                  size="lg"
                  className="w-full justify-start gap-2"
                  onClick={() => navigate({ to: '/tickets/create' })}
                >
                  <PlusIcon className="size-5 shrink-0" />
                  <span>Create New Ticket</span>
                </Button>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Menu Items Group */}
        <SidebarGroup className="p-0">
          <SidebarGroupContent className={cn(
            state === "collapsed" && "flex flex-col items-center gap-2"
          )}>
            <SidebarMenu className={cn(
              "flex flex-col gap-2",
              state === "collapsed" && "items-center"
            )}>
              {menuItems.map((item) => {
                const Icon = item.icon
                // Check if we're on edit ticket page
                const isOnEditTicketPage = location.pathname.match(/^\/tickets\/[^/]+\/edit$/)
                // Tickets menu item should not be active on create or edit pages
                const isActive = location.pathname === item.href || 
                  (item.href !== '/' && 
                   location.pathname.startsWith(item.href) && 
                   location.pathname !== '/tickets/create' &&
                   !(item.href === '/tickets' && isOnEditTicketPage))
                
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link to={item.href}>
                        <Icon className={cn(isActive && "stroke-3")} />
                        <span className={cn(isActive && "font-bold")}>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 pb-4">
        <SidebarGroup className="p-0">
          <SidebarGroupContent className={cn(state === "collapsed" && "flex justify-center")}>
            <SidebarMenu>
              <SidebarMenuItem>
                <UserDropdown />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </section>
  )
}

function UserDropdown() {
  const { user, logout, isLoading } = useAuth()
  const navigate = useNavigate()
  const { state } = useSidebar()

  // Debug: Log user data to see if it's being received
  React.useEffect(() => {
    if (user) {
      console.log('UserDropdown - User data:', user)
    }
  }, [user])

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const handleLogout = async () => {
    await logout()
    navigate({ to: '/auth/login', replace: true })
  }

  // Show skeleton if loading (isLoading from useAuth already includes Convex query loading)
  const showSkeleton = isLoading

  if (showSkeleton) {
    return (
      <SidebarMenuButton
        className={cn(
          "w-full justify-start gap-2 !p-2 h-auto",
          state === "collapsed" && "!size-8 !p-2 justify-center"
        )}
        disabled
      >
        <Skeleton className="size-8 shrink-0 rounded-full" />
        {state === "expanded" && (
          <>
            <div className="flex flex-col gap-1 items-start flex-1 min-w-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="size-4 shrink-0 rounded" />
          </>
        )}
      </SidebarMenuButton>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className={cn(
            "w-full justify-start gap-2 !p-2 h-auto",
            state === "collapsed" && "!size-8 !p-2 justify-center"
          )}
          tooltip={state === "collapsed" && user ? `${user.name} - ${user.orgName || 'Organization'}` : undefined}
        >
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={user?.profilePic} alt={user?.name || 'User'} />
            <AvatarFallback className="text-xs">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
          {state === "expanded" && (
            <>
              <div className="flex flex-col gap-1 items-start flex-1 min-w-0">
                <span className="text-sm font-medium truncate w-full">
                  {user?.name || 'User'}
                </span>
                <span className="text-xs text-muted-foreground truncate w-full">
                  {user?.orgName || 'Organization'}
                </span>
              </div>
              <ChevronRightIcon className="size-4 shrink-0" />
            </>
          )}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-48">
        <DropdownMenuItem>
          <SettingsIcon className="size-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <HelpCircleIcon className="size-4" />
          <span>Help</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOutIcon className="size-4" />
          <span>Log Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppSidebar() {
  return (
    <SidebarPrimitive
      collapsible="icon"
      className={cn(
        "bg-background",
        "data-[state=collapsed]:hover:cursor-ew-resize"
      )}
    >
      <SidebarContentComponent />
    </SidebarPrimitive>
  )
}

