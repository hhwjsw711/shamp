import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { FileWithPreview } from '@/hooks/use-file-upload'
import type { CreateTicketInput } from '@/lib/validations'
import { createTicketSchema } from '@/lib/validations'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import GalleryUpload from '@/components/file-upload/gallery-upload'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FormFooter } from '@/components/layout/form-footer'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_authenticated/tickets/create')({
  component: CreateTicketPage,
})

function CreateTicketPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const filesRef = useRef<Array<FileWithPreview>>([])

  const form = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      description: '',
      location: '',
      name: user?.name || '',
      photoIds: [],
      urgency: undefined,
    },
  })

  // Update name field when user data loads
  useEffect(() => {
    if (user?.name && !form.getValues('name')) {
      form.setValue('name', user.name)
    }
  }, [user, form])

  const handleFilesChange = (files: Array<FileWithPreview>) => {
    filesRef.current = files
    // Update form validation - extract IDs from files
    const photoIds = files.map(f => {
      if (f.file instanceof File) {
        return '' // Will be uploaded on submit
      } else {
        return f.file.id // Already uploaded
      }
    })
    form.setValue('photoIds', photoIds)
  }

  // Upload a single file and return its ID
  const uploadFile = async (file: File): Promise<string> => {
    const CONVEX_URL =
      import.meta.env.VITE_CONVEX_SITE_URL || 
      import.meta.env.VITE_CONVEX_URL?.replace('.convex.cloud', '.convex.site') ||
      ''

    if (!CONVEX_URL) {
      throw new Error('Convex URL is not configured')
    }

    const isNgrok = typeof window !== 'undefined' && (
      window.location.hostname.includes('ngrok.io') ||
      window.location.hostname.includes('ngrok-free.app') ||
      window.location.hostname.includes('ngrok-free.dev')
    )
    const hasHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
    const useSecureCookies = isNgrok || hasHttps

    let sessionToken: string | null = null
    
    if (!useSecureCookies && typeof window !== 'undefined') {
      sessionToken = localStorage.getItem('session_token')
      
      if (!sessionToken && typeof document !== 'undefined') {
        const cookies = document.cookie.split(';').map(c => c.trim())
        const sessionCookie = cookies.find(c => c.startsWith('session='))
        if (sessionCookie) {
          sessionToken = sessionCookie.split('=')[1]
        }
      }
    }

    const formData = new FormData()
    formData.append('file', file)

    const config: RequestInit = {
      method: 'POST',
      headers: {
        ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
      },
      credentials: 'include',
      body: formData,
    }

    const fullUrl = `${CONVEX_URL}/api/files/upload`
    const response = await fetch(fullUrl, config)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: response.statusText,
      }))
      throw new Error(errorData.error || errorData.message || 'Failed to upload file')
    }

    const result = await response.json()
    if (result.success && result.fileId) {
      return result.fileId
    } else {
      throw new Error('Failed to get file ID from upload response')
    }
  }

  const handleSubmit = async () => {
    const data = form.getValues()
    const isValid = await form.trigger()
    if (!isValid) return
    
    await onSubmit(data)
  }

  const onSubmit = async (data: CreateTicketInput) => {
    try {
      setIsSubmitting(true)
      setSubmitError(null)

      // Upload files that aren't already uploaded
      const filesToUpload = filesRef.current.filter(f => f.file instanceof File)
      const uploadedIds: Array<string> = []

      // Upload new files
      for (const fileItem of filesToUpload) {
        if (fileItem.file instanceof File) {
          const fileId = await uploadFile(fileItem.file)
          uploadedIds.push(fileId)
        }
      }

      // Get IDs from already uploaded files
      const existingIds = filesRef.current
        .filter(f => !(f.file instanceof File))
        .map(f => {
          const fileMetadata = f.file as { id: string }
          return fileMetadata.id
        })

      // Combine all photo IDs
      const allPhotoIds = [...existingIds, ...uploadedIds]

      if (allPhotoIds.length === 0) {
        setSubmitError('At least one photo is required')
        return
      }

      // Submit ticket with photo IDs
      await api.tickets.create({
        description: data.description,
        photoIds: allPhotoIds,
        location: data.location || undefined,
        name: data.name || undefined,
        urgency: data.urgency || undefined,
      })

      // Show success toast
      toast.success('Ticket Created Successfully', {
        description: 'Your maintenance request has been submitted.',
        duration: 4000,
      })
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate({ to: '/' })
      }, 1000)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <main className="flex flex-col items-center gap-6 p-4 md:p-6 lg:p-8 overflow-y-auto max-h-full">
      

      <Card className="border-0 rounded-2xl shadow-none max-w-[500px]">
        <CardHeader>
          <CardTitle>Ticket Details</CardTitle>
          <CardDescription>
            Provide information about the issue you're reporting and upload photos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Photos Upload - First Field */}
              <FormField
                control={form.control}
                name="photoIds"
                render={() => (
                  <FormItem>
                    <FormLabel>Photos</FormLabel>
                    <FormDescription>
                      Upload 1-5 photos showing the issue. Maximum 10MB per photo.
                    </FormDescription>
                    <FormControl>
                      <GalleryUpload
                        maxFiles={5}
                        maxSize={10 * 1024 * 1024} // 10MB
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        multiple={true}
                        onFilesChange={handleFilesChange}
                        className="max-w-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormDescription>
                      Provide a detailed description of the problem you're experiencing.
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Location */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (Optional)</FormLabel>
                    <FormDescription>
                      Where is this issue located? e.g., Room 205, Kitchen, Lobby
                    </FormDescription>
                    <FormControl>
                      <Input
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Urgency */}
              <FormField
                control={form.control}
                name="urgency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Urgency (Optional)</FormLabel>
                    <FormDescription>
                      How urgent is this issue? This helps prioritize your request. Leave unselected if unsure.
                    </FormDescription>
                      <FormControl>
                        <RadioGroup
                          value={field.value || ''}
                          onValueChange={(value) => field.onChange(value || undefined)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleSubmit()
                            }
                          }}
                          className="flex flex-col gap-3"
                        >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="emergency" id="urgency-emergency" />
                          <Label htmlFor="urgency-emergency" className="font-normal cursor-pointer">
                            Emergency - Critical: fire, flood, security, guest safety
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="urgent" id="urgency-urgent" />
                          <Label htmlFor="urgency-urgent" className="font-normal cursor-pointer">
                            Urgent - High: guest-facing issues, operational disruption
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="normal" id="urgency-normal" />
                          <Label htmlFor="urgency-normal" className="font-normal cursor-pointer">
                            Normal - Standard: routine maintenance
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="low" id="urgency-low" />
                          <Label htmlFor="urgency-low" className="font-normal cursor-pointer">
                            Low - Non-critical: cosmetic issues
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />



              {/* Error Alert */}
              {submitError && (
                <Alert variant="destructive">
                  <TriangleAlert className="size-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              {/* Hidden submit button to enable Enter key submission */}
              <button
                type="submit"
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
            </form>
          </Form>
        </CardContent>
      </Card>
      </main>
      
      <FormFooter
        onSubmit={handleSubmit}
        onCancel={() => navigate({ to: '/' })}
        isSubmitting={isSubmitting}
        submitLabel="Create Ticket"
        cancelLabel="Cancel"
      />
    </>
  )
}

