import * as React from 'react'

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

export function PageHeaderCTAsContainer() {
  const { ctas } = usePageHeaderCTAs()

  if (!ctas) {
    return null
  }

  return (
    <section className="flex items-center gap-2 shrink-0">
      {ctas}
    </section>
  )
}

