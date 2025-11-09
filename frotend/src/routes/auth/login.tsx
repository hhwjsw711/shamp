import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { Loader2Icon, OctagonXIcon } from 'lucide-react'
import type { LoginInput } from '@/lib/validations'
import { loginSchema } from '@/lib/validations'
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

export const Route = createFileRoute('/auth/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { login, getGoogleAuthUrl } = useAuth()
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
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

  const onSubmit = async (data: LoginInput) => {
    setIsEmailLoading(true)
    setError(null)

    const result = await login(data)

    if (result.success && result.user) {
      toast.success('Logged in successfully!')
      
      // Detect if using ngrok/production (HTTPS) - cookies work properly
      const isNgrok = typeof window !== 'undefined' && (
        window.location.hostname.includes('ngrok.io') ||
        window.location.hostname.includes('ngrok-free.app') ||
        window.location.hostname.includes('ngrok-free.dev')
      )
      const hasHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
      const useSecureCookies = isNgrok || hasHttps
      
      // Store token in localStorage only for localhost HTTP (fallback)
      // For ngrok/production, rely solely on secure cookies
      if (result.token && typeof window !== 'undefined' && !useSecureCookies) {
        localStorage.setItem('session_token', result.token)
      }
      
      // Use login response data to determine redirect
      const user = result.user as {
        onboardingCompleted?: boolean
        emailVerified?: boolean
      }
      
      if (!user.onboardingCompleted) {
        // First-time user - redirect to onboarding
        // For ngrok/production: use secure cookies (no URL token)
        // For localhost HTTP: pass token as URL parameter (fallback)
        const onboardingUrl = (!useSecureCookies && result.token)
          ? `/auth/onboarding?token=${encodeURIComponent(result.token)}`
          : '/auth/onboarding'
        window.location.href = onboardingUrl
      } else {
        // Existing user - redirect to home
        navigate({ to: '/' })
      }
    } else {
      setError(result.error || 'Failed to login')
      setIsEmailLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    const result = await getGoogleAuthUrl()

    if (result.success && result.url) {
      window.location.href = result.url
    } else {
      toast.error(result.error || 'Failed to initiate Google sign in')
      setIsGoogleLoading(false)
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
          {/* Header with logo and create account button */}
          <section className="w-full flex items-center justify-between">
            <img
              src="/shamp-logo.svg"
              alt="Shamp Logo"
              className="h-8 w-auto"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: '/auth/create-account' })}
            >
              Create Account
            </Button>
          </section>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Log in to your account to continue
          </p>
        </section>

        {/* Form section */}
        <section className="flex flex-col gap-4 w-full">
          {/* Google sign in button */}
          <section>
            <Button
              type="button"
              variant="glass"
              className="w-full"
              size="lg"
              onClick={handleGoogleSignIn}
              disabled={isEmailLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2Icon className="w-5 h-5 mr-2 animate-spin" />
                  Logging In...
                </>
              ) : (
                <>
                  <img
                    src="/google-icon-logo.svg"
                    alt="Google"
                    className="w-5 h-5 mr-2"
                  />
                  Log In with Google
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
                  disabled={isEmailLoading || isGoogleLoading}
                  size="lg"
                >
                  {isEmailLoading ? (
                    <>
                      <Spinner className="mr-2" />
                      Logging In...
                    </>
                  ) : (
                    'Log In'
                  )}
                </Button>
              </form>
            </Form>
          </section>
        </section>
      </motion.section>
    </motion.main>
  )
}

