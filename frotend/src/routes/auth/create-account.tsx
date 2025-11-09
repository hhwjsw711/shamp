import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2Icon, OctagonXIcon } from 'lucide-react'
import type { RegisterInput } from '@/lib/validations'
import { registerSchema } from '@/lib/validations'
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
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Toggle } from '@/components/ui/toggle'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/auth/create-account')({
  component: CreateAccountPage,
})

function CreateAccountPage() {
  const { register, getGoogleAuthUrl } = useAuth()
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
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

  const onSubmit = async (data: RegisterInput) => {
    setIsEmailLoading(true)
    setError(null) // Clear previous errors

    const result = await register(data)

    if (result.success) {
      toast.success('Account created successfully!')
      // Navigate to verify email page with email in query params
      // Using window.location since the route doesn't exist yet
      window.location.href = `/auth/verify-email?email=${encodeURIComponent(data.email)}`
    } else {
      // Set error to display in Alert component
      setError(result.error || 'Failed to create account')
      setIsEmailLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true)
    const result = await getGoogleAuthUrl()

    if (result.success && result.url) {
      window.location.href = result.url
    } else {
      toast.error(result.error || 'Failed to initiate Google sign up')
      setIsGoogleLoading(false)
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
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

      <section className="w-full max-w-md p-8 rounded-[22px] flex flex-col items-start gap-8 bg-background/98 backdrop-blur-md shadow-2xl border border-border/20 relative z-10">
        {/* Logo and heading section */}
        <section className="flex flex-col gap-1 w-full items-start">
          <img
            src="/shamp-logo.svg"
            alt="Shamp Logo"
            className="h-8 w-auto"
          />
          <h1 className="text-2xl font-semibold text-foreground">
            Maintenance management made simple for hotels & restaurants
          </h1>
          <p className="text-sm text-muted-foreground">
            Create account below to get started
          </p>
        </section>

        {/* Form section */}
        <section className="flex flex-col gap-4 w-full">
          {/* Google sign up button */}
          <section>
            <Button
              type="button"
              variant="glass"
              className="w-full"
              size="lg"
              onClick={handleGoogleSignUp}
              disabled={isEmailLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2Icon className="w-5 h-5 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <img
                    src="/google-icon-logo.svg"
                    alt="Google"
                    className="w-5 h-5 mr-2"
                  />
                  Get started with Google
                </>
              )}
            </Button>
          </section>

          {/* Separator with "or" */}
          <section className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </section>

          {/* Email and password form */}
          <section className="flex flex-col gap-4">
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

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <FormLabel>Password</FormLabel>
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
                          type={showPassword ? "text" : "password"}
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

                <p className="text-sm text-muted-foreground">
                  By creating an account, you agree to Shamp's{' '}
                  <a
                    href="/terms"
                    className="text-primary hover:underline underline-offset-4"
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a
                    href="/privacy"
                    className="text-primary hover:underline underline-offset-4"
                  >
                    Privacy Policy
                  </a>
                </p>

                {error && (
                  <Alert variant="destructive">
                    <OctagonXIcon />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full mt-4"
                  disabled={isEmailLoading || isGoogleLoading}
                  size="lg"
                >
                  {isEmailLoading ? (
                    <>
                      <Spinner className="mr-2" />
                      Creating account...
                    </>
                  ) : (
                    'Create account'
                  )}
                </Button>
              </form>
            </Form>
          </section>
        </section>
      </section>
    </main>
  )
}

