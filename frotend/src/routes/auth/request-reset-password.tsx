import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { OctagonXIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PasswordResetRequestInput } from '@/lib/validations'
import { createValidationSchemas } from '@/lib/validations'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/auth/request-reset-password')({
  component: RequestResetPasswordPage,
})

function RequestResetPasswordPage() {
  const navigate = useNavigate()
  const { requestPasswordReset } = useAuth()
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Create validation schemas with translations
  const schemas = useMemo(() => createValidationSchemas(t), [t])

  const form = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(schemas.passwordResetRequestSchema),
    defaultValues: {
      email: '',
    },
  })

  // Clear error when form fields change
  const handleFieldChange = () => {
    if (error) {
      setError(null)
    }
  }

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const onSubmit = async (data: PasswordResetRequestInput) => {
    setIsLoading(true)
    setError(null)

    const result = await requestPasswordReset(data)

    if (result.success) {
      toast.success(t($ => $.auth.resetPassword.success))
      setSuccess(true)
      // Navigate to reset password code page with email after 2 seconds
      setTimeout(() => {
        navigate({
          to: '/auth/reset-password-code',
          search: { email: data.email },
        })
      }, 2000)
    } else {
      setError(result.error || t($ => $.auth.resetPassword.error))
      setIsLoading(false)
    }
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundColor: '#fafafa',
        backgroundImage: "url('/auth-background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'right center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/15" />
      <style>{`
        @media (max-width: 768px) {
          main {
            background-position: center center !important;
          }
        }
      `}</style>

      <motion.section
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -20, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md p-8 rounded-[22px] flex flex-col items-start gap-8 bg-background/98 backdrop-blur-md shadow-2xl border border-border/20 relative z-10"
      >
        {/* Heading section */}
        <section className="flex flex-col gap-2 w-full items-start">
          {/* Header with logo and login button */}
          <section className="w-full flex items-center justify-between">
            <img
              src="/shamp-logo.svg"
              alt="Shamp Logo"
              className="h-8 w-auto"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: '/auth/login' })}
            >
              {t($ => $.auth.resetPassword.backToLogin)}
            </Button>
          </section>
          <h1 className="text-2xl font-semibold text-foreground">
            {t($ => $.auth.resetPassword.requestTitle)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t($ => $.auth.resetPassword.requestSubtitle)}
          </p>
        </section>

        {/* Form section */}
        {success ? (
          <section className="flex flex-col gap-4 w-full">
            <Alert>
              <AlertDescription>
                {t($ => $.auth.resetPassword.success)}
              </AlertDescription>
            </Alert>
          </section>
        ) : (
          <section className="flex flex-col gap-4 w-full">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t($ => $.auth.resetPassword.emailLabel)}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            handleFieldChange()
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {error && (
                  <Alert variant="destructive">
                    <OctagonXIcon />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  variant="default-glass"
                  className="w-full mt-4"
                  disabled={isLoading}
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Spinner className="mr-2" />
                      {t($ => $.common.buttons.loading)}
                    </>
                  ) : (
                    t($ => $.auth.resetPassword.requestButton)
                  )}
                </Button>
              </form>
            </Form>
          </section>
        )}
      </motion.section>
    </motion.main>
  )
}
