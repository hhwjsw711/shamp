import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { OctagonXIcon } from 'lucide-react'

import type { OnboardingInput } from '@/lib/validations'
import { onboardingSchema } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/base-combobox'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/auth/onboarding')({
  component: OnboardingPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search.token as string) || undefined,
    }
  },
  beforeLoad: async () => {
    // Parent layout (_authenticated.tsx) already handles authentication
    // Here we only need onboarding-specific checks
    try {
      const response = await api.auth.me()
      
      if (response.user) {
        const user = response.user as {
          onboardingCompleted?: boolean
          emailVerified?: boolean
          email: string
        }
        
        // Redirect if onboarding already completed
        if (user.onboardingCompleted) {
          throw redirect({
            to: '/',
            replace: true,
          })
        }
        
        // Redirect if email not verified (shouldn't happen, but safety check)
        if (!user.emailVerified) {
          throw redirect({
            to: '/auth/verify-email',
            search: {
              email: user.email,
            },
            replace: true,
          })
        }
      }
    } catch (error) {
      // If it's a redirect, rethrow it
      if (
        error &&
        typeof error === 'object' &&
        ('status' in error || 'to' in error)
      ) {
        throw error
      }
      // Otherwise, let parent layout handle auth errors
      throw error
    }
  },
})

function OnboardingPage() {
  const navigate = useNavigate()
  const { completeOnboarding, getCurrentUser, user } = useAuth()
  const { token } = Route.useSearch()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasCheckedUser = useRef(false)
  const hasSetName = useRef(false)

  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: '',
      orgName: '',
      location: '',
    },
  })

  // Remove token from URL after beforeLoad has processed it
  useEffect(() => {
    if (token) {
      const url = new URL(window.location.href)
      url.searchParams.delete('token')
      window.history.replaceState({}, '', url.toString())
    }
  }, [token])

  // Fetch user data on mount to populate form (beforeLoad already verified auth)
  useEffect(() => {
    if (hasCheckedUser.current) return
    hasCheckedUser.current = true

    let isMounted = true

    const fetchUser = async () => {
      try {
        const result = await getCurrentUser()
        if (!isMounted) return

        if (result.success && result.user) {
          const userData = result.user as {
            name?: string
          }
          
          // Set name if available and not already set
          if (userData.name && !hasSetName.current) {
            form.setValue('name', userData.name)
            hasSetName.current = true
          }
        }
      } catch (err) {
        console.error('Failed to fetch user:', err)
        // Don't block the form - beforeLoad already verified auth
      }
    }

    fetchUser()

    return () => {
      isMounted = false
    }
  }, [getCurrentUser, form])

  // Also sync name when user changes (in case it updates after initial fetch)
  useEffect(() => {
    if (user?.name && !hasSetName.current) {
      form.setValue('name', user.name)
      hasSetName.current = true
    }
  }, [user?.name])

  // Google Places Autocomplete - manual integration (SSR-safe)
  const [placesValue, setPlacesValue] = useState('')
  const [placesSuggestions, setPlacesSuggestions] = useState<Array<{ place_id: string; description: string }>>([])
  const [placesStatus, setPlacesStatus] = useState<string>('')
  const [autocompleteService, setAutocompleteService] = useState<any>(null)
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false)

  // Initialize Google Places Autocomplete Service - check immediately and on mount
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (typeof window !== 'undefined') {
        const google = (window as any).google
        if (google?.maps?.places) {
          setAutocompleteService(new google.maps.places.AutocompleteService())
          setIsGoogleMapsReady(true)
          return true
        }
      }
      return false
    }

    // Check immediately
    if (checkGoogleMaps()) {
      return
    }

    // If not ready, poll for it (script loading from root)
    const interval = setInterval(() => {
      if (checkGoogleMaps()) {
        clearInterval(interval)
      }
    }, 100)

    // Cleanup after 10 seconds max
    const timeout = setTimeout(() => {
      clearInterval(interval)
    }, 10000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  // Debounced search for places
  useEffect(() => {
    if (!autocompleteService || !placesValue || placesValue.length < 3) {
      setPlacesSuggestions([])
      setPlacesStatus('')
      return
    }

    const timeoutId = setTimeout(() => {
      if (autocompleteService) {
        autocompleteService.getPlacePredictions(
          {
            input: placesValue,
          },
          (predictions: Array<any> | null, status: string) => {
            const google = (window as any).google
            if (status === google?.maps?.places?.PlacesServiceStatus?.OK && predictions) {
              setPlacesSuggestions(
                predictions.map((p: any) => ({
                  place_id: p.place_id,
                  description: p.description,
                }))
              )
              setPlacesStatus('OK')
            } else {
              setPlacesSuggestions([])
              const zeroResults = google?.maps?.places?.PlacesServiceStatus?.ZERO_RESULTS
              setPlacesStatus(status === zeroResults ? 'ZERO_RESULTS' : '')
            }
          }
        )
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [placesValue, autocompleteService])

  const locationValue = form.watch('location')

  // Sync placesValue with form field value (only when form changes externally, not null)
  useEffect(() => {
    if (locationValue && locationValue !== 'null' && locationValue !== placesValue) {
      setPlacesValue(locationValue)
    } else if (!locationValue || locationValue === 'null') {
      setPlacesValue('')
    }
  }, [locationValue, placesValue])

  const handleLocationChange = useCallback(
    (newValue: string) => {
      setPlacesValue(newValue)
      form.setValue('location', newValue, { shouldValidate: true })
      if (error) {
        setError(null)
      }
    },
    [error]
  )

  const handleLocationSelect = useCallback(
    (description: string) => {
      setPlacesValue(description)
      setPlacesSuggestions([])
      setPlacesStatus('')
      form.setValue('location', description, { shouldValidate: true })
    },
    []
  )

  const handleFieldChange = () => {
    if (error) {
      setError(null)
    }
  }

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const onSubmit = async (formData: OnboardingInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await completeOnboarding(formData)

      if (result.success) {
        toast.success('Profile completed successfully!')
        navigate({ to: '/' })
      } else {
        setError(result.error || 'Failed to complete onboarding')
        setIsLoading(false)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to complete onboarding'
      )
      setIsLoading(false)
    }
  }

  // Don't show loading screen - form is always available
  // User data will be populated asynchronously if needed

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
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

      <motion.section
        initial={{ x: 0, opacity: 1 }}
        exit={{ x: -20, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeIn' }}
        className="w-full max-w-md p-8 rounded-[22px] flex flex-col items-start gap-8 bg-background/98 backdrop-blur-md shadow-2xl border border-border/20 relative z-10"
      >
        <section className="flex flex-col gap-2 w-full items-start">
          <img
            src="/shamp-logo.svg"
            alt="Shamp Logo"
            className="h-8 w-auto"
          />
          <h1 className="text-2xl font-semibold text-foreground">
            Complete your profile
          </h1>
          <p className="text-sm text-muted-foreground">
            Tell us about you and your business to get started.
          </p>
        </section>

        <section className="flex flex-col gap-4 w-full">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
              autoComplete="off"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        {...field}
                        value={field.value || ''}
                        disabled={Boolean(user?.name || form.getValues('name'))}
                        onChange={(e) => {
                          field.onChange(e)
                          handleFieldChange()
                        }}
                        autoComplete="name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orgName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          handleFieldChange()
                        }}
                        autoComplete="organization"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Location</FormLabel>
                    <FormControl>
                      {!isGoogleMapsReady ? (
                        <Input
                          type="text"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            field.onChange(e)
                            handleFieldChange()
                          }}
                          placeholder="Enter your business location"
                          autoComplete="address-line1"
                        />
                      ) : (
                        <Combobox
                          value={placesValue || ''}
                          onValueChange={(value) => {
                            const stringValue = typeof value === 'string' ? value : String(value)
                            handleLocationChange(stringValue)
                          }}
                        >
                          <ComboboxControl>
                            <ComboboxInput
                              value={placesValue}
                              onChange={(e) => {
                                handleLocationChange(e.target.value)
                              }}
                              placeholder="Search for your business location"
                              autoComplete="off"
                              variant="md"
                            />
                          </ComboboxControl>
                          <ComboboxContent>
                            {placesStatus === 'OK' && placesSuggestions.length > 0 ? (
                              <ComboboxList>
                                {placesSuggestions.map((suggestion) => (
                                  <ComboboxItem
                                    key={suggestion.place_id}
                                    value={suggestion.description}
                                    onSelect={() => {
                                      handleLocationSelect(suggestion.description)
                                    }}
                                  >
                                    {suggestion.description}
                                  </ComboboxItem>
                                ))}
                              </ComboboxList>
                            ) : placesStatus === 'ZERO_RESULTS' ? (
                              <ComboboxEmpty>
                                No locations found. Try a different search.
                              </ComboboxEmpty>
                            ) : null}
                          </ComboboxContent>
                        </Combobox>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <Alert variant="destructive">
                  <OctagonXIcon className="h-4 w-4" />
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
                    Finishing up...
                  </>
                ) : (
                  'Finish setup'
                )}
              </Button>
            </form>
          </Form>
        </section>
      </motion.section>
    </motion.main>
  )
}
