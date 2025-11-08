import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { toast } from 'sonner'
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

export const Route = createFileRoute('/auth/create-account')({
  component: CreateAccountPage,
})

function CreateAccountPage() {
  const { register, getGoogleAuthUrl } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true)
    const result = await register(data)

    if (result.success) {
      toast.success('Account created successfully!')
      // Navigate to verify email page with email in query params
      // Using window.location since the route doesn't exist yet
      window.location.href = `/auth/verify-email?email=${encodeURIComponent(data.email)}`
    } else {
      toast.error(result.error || 'Failed to create account')
    }

    setIsLoading(false)
  }

  const handleGoogleSignUp = async () => {
    setIsLoading(true)
    const result = await getGoogleAuthUrl()

    if (result.success && result.url) {
      window.location.href = result.url
    } else {
      toast.error(result.error || 'Failed to initiate Google sign up')
      setIsLoading(false)
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: "url('/auth-background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'right center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          main {
            background-position: center center !important;
          }
        }
      `}</style>

      <section className="w-full max-w-md p-4 rounded-[22px] flex flex-col items-start gap-3 bg-background/95 backdrop-blur-sm">
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
        <section className="flex flex-col gap-2 w-full">
          {/* Google sign up button */}
          <section>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignUp}
              disabled={isLoading}
            >
              <img
                src="/google-icon-logo.svg"
                alt="Google"
                className="w-5 h-5 mr-2"
              />
              Get started with Google
            </Button>
          </section>

          {/* Separator with "or" */}
          <section className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </section>

          {/* Email and password form */}
          <section className="flex flex-col gap-2">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-2"
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
                          placeholder="Enter your email"
                          {...field}
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
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Create a password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </Form>
          </section>
        </section>
      </section>
    </main>
  )
}

