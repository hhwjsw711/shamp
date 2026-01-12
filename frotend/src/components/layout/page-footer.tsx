import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

// Context for page footer actions
interface PageFooterContextType {
  onSubmit?: () => void
  onCancel?: () => void
  isSubmitting?: boolean
  submitLabel?: string
  cancelLabel?: string
  showFooter?: boolean
}

const PageFooterContext = React.createContext<PageFooterContextType>({})

export const PageFooterProvider: React.FC<{
  children: React.ReactNode
  value: PageFooterContextType
}> = ({ children, value }) => {
  return (
    <PageFooterContext.Provider value={value}>
      {children}
    </PageFooterContext.Provider>
  )
}

export const usePageFooter = () => {
  return React.useContext(PageFooterContext)
}

export function PageFooter() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const {
    onSubmit,
    onCancel,
    isSubmitting = false,
    submitLabel = 'Submit',
    cancelLabel = 'Cancel',
    showFooter = false
  } = usePageFooter()

  // Only show footer on specific pages that need it
  if (!showFooter) {
    return null
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      // Default cancel behavior - go back to home
      navigate({ to: '/' })
    }
  }

  return (
    <footer className="bg-zinc-100 rounded-[22px] px-4 py-2">
      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Spinner className="mr-2 size-4" />
              {t($ => $.formFooter.submitting).replace('{label}', submitLabel)}
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </footer>
  )
}