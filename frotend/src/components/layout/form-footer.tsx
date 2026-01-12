import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

interface FormFooterProps {
  onSubmit: () => void
  onCancel?: () => void
  isSubmitting?: boolean
  submitLabel?: string
  cancelLabel?: string
  className?: string
}

export function FormFooter({
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  className = ''
}: FormFooterProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      // Default cancel behavior - go back to home
      navigate({ to: '/' })
    }
  }

  return (
    <footer className={`bg-zinc-100 rounded-[22px] px-4 py-2 ${className}`}>
      <div className="flex items-center justify-center">
        <div className="w-full max-w-[500px] flex items-center justify-start gap-4">
          <Button
            type="button"
            variant="default-glass"
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
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </footer>
  )
}