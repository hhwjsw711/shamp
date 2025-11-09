import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { OctagonXIcon } from 'lucide-react'
import type { PasswordResetRequestInput } from '@/lib/validations'
import { passwordResetRequestSchema } from '@/lib/validations'
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
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
      toast.success('Password reset code sent! Check your email.')
      setSuccess(true)
      // Navigate to reset password code page with email after 2 seconds
      setTimeout(() => {
        navigate({
          to: '/auth/reset-password-code',
          search: { email: data.email },
        })
      }, 2000)
    } else {
      setError(result.error || 'Failed to request password reset')
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
            Enter your email address and we'll send you a code to reset your password
          </p>
        </section>

        {/* Form section */}
        {success ? (
          <section className="flex flex-col gap-4 w-full">
            <Alert>
              <AlertDescription>
                If an account with this email exists, a password reset code has been sent. Please check your email.
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
                      <FormLabel>Email</FormLabel>
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
                      Sending...
                    </>
                  ) : (
                    'Send Reset Code'
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
