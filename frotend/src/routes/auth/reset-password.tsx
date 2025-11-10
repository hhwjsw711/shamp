import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { OctagonXIcon } from 'lucide-react'
import type { PasswordResetCompleteInput } from '@/lib/validations'
import { passwordResetCompleteSchema } from '@/lib/validations'
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const { email, userId } = Route.useSearch()

  const form = useForm<PasswordResetCompleteInput>({
    resolver: zodResolver(passwordResetCompleteSchema),
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
      toast.success('Password reset successfully! Please sign in with your new password.')
      navigate({ to: '/auth/login' })
    } else {
      setError(result.error || 'Failed to reset password')
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
              Log In
            </Button>
          </section>
          <h1 className="text-2xl font-semibold text-foreground">
            Reset password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below
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
                    <FormLabel>New password</FormLabel>
                    <Toggle
                      pressed={showPassword}
                      onPressedChange={setShowPassword}
                      size="sm"
                      aria-label="Toggle password visibility"
                      className="absolute text-muted-foreground top-0 right-0 z-10 bg-transparent hover:bg-transparent data-[state=on]:bg-transparent h-auto p-0 min-w-0"
                    >
                      {showPassword ? 'Hide password' : 'Show password'}
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
                    <FormLabel>Confirm password</FormLabel>
                    <Toggle
                      pressed={showConfirmPassword}
                      onPressedChange={setShowConfirmPassword}
                      size="sm"
                      aria-label="Toggle confirm password visibility"
                      className="absolute text-muted-foreground top-0 right-0 z-10 bg-transparent hover:bg-transparent data-[state=on]:bg-transparent h-auto p-0 min-w-0"
                    >
                      {showConfirmPassword ? 'Hide password' : 'Show password'}
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
                    Resetting password...
                  </>
                ) : (
                  'Reset password'
                )}
              </Button>
            </form>
          </Form>
        </section>
      </motion.section>
    </motion.main>
  )
}
