import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Building2Icon, ChevronRightIcon, HelpCircleIcon, HomeIcon, LogOutIcon, MessageSquareIcon, SettingsIcon, TicketIcon } from 'lucide-react'
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
  const { state } = useSidebar()

  return (
    <div className="flex flex-col p-4 gap-4 bg-background h-full">
      <SidebarHeader className="w-full flex justify-between items-center p-0">
        <div className="relative w-full flex justify-between items-center">
          {/* Favicon - shows when expanded or when collapsed and not hovering */}
          <img
            src="/shamp-favicon.png"
            alt="Shamp Logo"
            className={cn(
              "size-8 transition-opacity duration-200",
              state === "collapsed" && "opacity-100 group-hover/sidebar-wrapper:opacity-0"
            )}
          />
          {/* SidebarTrigger - shows when expanded or when collapsed and hovering */}
          <SidebarTrigger
            className={cn(
              "transition-opacity duration-200",
              state === "collapsed" && "opacity-0 group-hover/sidebar-wrapper:opacity-100 absolute right-0"
            )}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="p-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="flex flex-col gap-2">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href || 
                  (item.href !== '/' && location.pathname.startsWith(item.href))
                
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link to={item.href}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <UserDropdown />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </div>
  )
}

function UserDropdown() {
  const { user, logout } = useAuth()
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="w-full justify-start gap-2 bg-red-500 p-4"
          tooltip={state === "collapsed" ? `${user?.name || 'User'} - ${user?.orgName || 'Organization'}` : undefined}
        >
          <Avatar className="size-8">
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

