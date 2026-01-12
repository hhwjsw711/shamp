import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { OctagonXIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PasswordResetCompleteInput } from '@/lib/validations'
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
import { Toggle } from '@/components/ui/toggle'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/auth/reset-password')({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      email: (search.email as string) || '',
      userId: (search.userId as string) || '',
    }
  },
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const { completePasswordReset } = useAuth()
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const { email, userId } = Route.useSearch()

  // Create validation schemas with translations
  const schemas = useMemo(() => createValidationSchemas(t), [t])

  const form = useForm<PasswordResetCompleteInput>({
    resolver: zodResolver(schemas.passwordResetCompleteSchema),
    defaultValues: {
      userId: userId || '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  // Update form userId when search params change
  useEffect(() => {
    if (userId) {
      form.setValue('userId', userId)
    }
  }, [userId, form])

  // Redirect if no email or userId provided
  useEffect(() => {
    if (!email || !userId) {
      navigate({ to: '/auth/request-reset-password' })
    }
  }, [email, userId, navigate])

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

  const onSubmit = async (data: PasswordResetCompleteInput) => {
    if (!userId) {
      setError('Invalid user ID. Please start over.')
      navigate({ to: '/auth/request-reset-password' })
      return
    }

    setIsLoading(true)
    setError(null)

    const result = await completePasswordReset({
      ...data,
      userId,
    })

    if (result.success) {
      toast.success(t($ => $.auth.resetPassword.success))
      navigate({ to: '/auth/login' })
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
              {t($ => $.auth.login.loginButton)}
            </Button>
          </section>
          <h1 className="text-2xl font-semibold text-foreground">
            {t($ => $.auth.resetPassword.newPasswordTitle)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t($ => $.auth.resetPassword.newPasswordSubtitle)}
          </p>
        </section>

        {/* Form section */}
        <section className="flex flex-col gap-4 w-full">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              {/* Password field */}
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>{t($ => $.auth.resetPassword.passwordLabel)}</FormLabel>
                    <Toggle
                      pressed={showPassword}
                      onPressedChange={setShowPassword}
                      size="sm"
                      aria-label="Toggle password visibility"
                      className="absolute text-muted-foreground top-0 right-0 z-10 bg-transparent hover:bg-transparent data-[state=on]:bg-transparent h-auto p-0 min-w-0"
                    >
                      {showPassword ? t($ => $.common.buttons.hidePassword) : t($ => $.common.buttons.showPassword)}
                    </Toggle>
                    <FormControl>
                      <Input
                        type={showPassword ? 'text' : 'password'}
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

              {/* Confirm password field */}
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>{t($ => $.auth.resetPassword.confirmPasswordLabel)}</FormLabel>
                    <Toggle
                      pressed={showConfirmPassword}
                      onPressedChange={setShowConfirmPassword}
                      size="sm"
                      aria-label="Toggle confirm password visibility"
                      className="absolute text-muted-foreground top-0 right-0 z-10 bg-transparent hover:bg-transparent data-[state=on]:bg-transparent h-auto p-0 min-w-0"
                    >
                      {showConfirmPassword ? t($ => $.common.buttons.hidePassword) : t($ => $.common.buttons.showPassword)}
                    </Toggle>
                    <FormControl>
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
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
                    {t($ => $.auth.resetPassword.resetting)}
                  </>
                ) : (
                  t($ => $.auth.resetPassword.resetButton)
                )}
              </Button>
            </form>
          </Form>
        </section>
      </motion.section>
    </motion.main>
  )
}
