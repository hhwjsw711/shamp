import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, TriangleAlert } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { FormFooter } from '@/components/layout/form-footer'

export const Route = createFileRoute('/_authenticated/tickets/create')({
  component: CreateTicketPage,
})

function CreateTicketPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const filesRef = useRef<Array<FileWithPreview>>([])

  const form = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      description: '',
      location: '',
      name: user?.name || '',
      photoIds: [],
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
      setSubmitSuccess(false)

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
      })

      setSubmitSuccess(true)
      // Redirect to dashboard after a short delay (ticket detail page doesn't exist yet)
      setTimeout(() => {
        navigate({ to: '/' })
      }, 1500)
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



              {/* Error Alert */}
              {submitError && (
                <Alert variant="destructive">
                  <TriangleAlert className="size-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              {/* Success Alert */}
              {submitSuccess && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                  <AlertTitle className="text-green-800 dark:text-green-200">
                    Ticket Created Successfully
                  </AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-300">
                    Redirecting to ticket details...
                  </AlertDescription>
                </Alert>
              )}


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

