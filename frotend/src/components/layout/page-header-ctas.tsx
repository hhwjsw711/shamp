import * as React from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface PageHeaderCTAsContextValue {
  ctas: React.ReactNode | null
  setCTAs: (ctas: React.ReactNode | null) => void
}

const PageHeaderCTAsContext = React.createContext<PageHeaderCTAsContextValue | undefined>(undefined)

export function PageHeaderCTAsProvider({ children }: { children: React.ReactNode }) {
  const [ctas, setCTAs] = React.useState<React.ReactNode | null>(null)

  return (
    <PageHeaderCTAsContext.Provider value={{ ctas, setCTAs }}>
      {children}
    </PageHeaderCTAsContext.Provider>
  )
}

export function usePageHeaderCTAs() {
  const context = React.useContext(PageHeaderCTAsContext)
  if (!context) {
    throw new Error('usePageHeaderCTAs must be used within PageHeaderCTAsProvider')
  }
  return context
}

function processButton(child: React.ReactNode, index: number): React.ReactNode {
  if (!React.isValidElement(child)) {
    return child
  }

  const originalProps = child.props as { 
    className?: string
    size?: string | 'icon'
    variant?: string
    'aria-label'?: string
    children?: React.ReactNode
    onClick?: () => void
    [key: string]: any
  }
  
  // Check if this is an icon button (size="icon" or size="icon-sm" etc)
  const isIconButton = originalProps.size === 'icon' || originalProps.size === 'icon-sm' || originalProps.size === 'icon-lg'
  
  if (isIconButton) {
    // Determine text and icon based on aria-label (most reliable)
    const ariaLabel = String(originalProps['aria-label'] || '').toLowerCase()
    let buttonText = ''
    let iconComponent: React.ReactNode = null
    
    // Check aria-label first
    if (ariaLabel.includes('edit')) {
      buttonText = 'Edit'
      iconComponent = <Pencil className="size-4" />
    } else if (ariaLabel.includes('delete')) {
      buttonText = 'Delete'
      iconComponent = <Trash2 className="size-4" />
    } else {
      // Fallback: check the icon component directly
      const icon = originalProps.children
      if (React.isValidElement(icon)) {
        // Try to match by checking the component's name or type
        const iconType = icon.type
        const iconName = String((iconType as any)?.name || (iconType as any)?.displayName || '').toLowerCase()
        
        if (iconName.includes('pencil') || iconType === Pencil) {
          buttonText = 'Edit'
          iconComponent = <Pencil className="size-4" />
        } else if (iconName.includes('trash') || iconType === Trash2) {
          buttonText = 'Delete'
          iconComponent = <Trash2 className="size-4" />
        } else {
          // If we can't identify, keep original icon but add generic text
          iconComponent = icon
          buttonText = 'Action'
        }
      }
    }
    
    // Create new ghost button with text instead of cloning
    // Only for mobile view - add labels to icon buttons
    if (buttonText && iconComponent) {
      const { children, size, variant, className, key, ...restProps } = originalProps
      
      return (
        <Button
          key={key || `mobile-cta-${index}`}
          variant="ghost"
          size="default"
          className={`w-full justify-start gap-2 ${className || ''}`}
          {...restProps}
        >
          {iconComponent}
          <span>{buttonText}</span>
        </Button>
      )
    }
  }
  
  // For non-icon buttons, just make them full-width
  return React.cloneElement(child as React.ReactElement<any>, {
    ...originalProps,
    className: `${originalProps.className || ''} w-full justify-start`,
    key: originalProps.key || index,
  })
}

export function PageHeaderCTAsContainer() {
  const { ctas } = usePageHeaderCTAs()

  if (!ctas) {
    return null
  }

  return (
    <>
      {/* Desktop: Show buttons directly */}
      <section className="hidden md:flex items-center gap-2 shrink-0">
        {ctas}
      </section>
      
      {/* Mobile: Show dropdown menu with ellipsis icon */}
      <section className="flex md:hidden items-center shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex flex-col gap-1.5 p-1.5">
              {React.Children.map(React.Children.toArray(ctas), (child, index) => {
                // Handle React fragments (section wrapper)
                if (React.isValidElement(child) && child.type === React.Fragment) {
                  const fragmentProps = child.props as { children?: React.ReactNode }
                  return React.Children.map(React.Children.toArray(fragmentProps.children || []), (fragmentChild, fragIndex) => {
                    return processButton(fragmentChild, fragIndex)
                  })
                }
                
                // Handle section wrapper
                if (React.isValidElement(child) && typeof child.type === 'string' && child.type === 'section') {
                  const sectionProps = child.props as { children?: React.ReactNode }
                  return React.Children.map(React.Children.toArray(sectionProps.children || []), (sectionChild, sectionIndex) => {
                    return processButton(sectionChild, sectionIndex)
                  })
                }
                
                return processButton(child, index)
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </section>
    </>
  )
}

