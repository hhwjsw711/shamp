import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { FileMetadata, FileWithPreview } from '@/hooks/use-file-upload'
import type { CreateTicketInput } from '@/lib/validations'
import { createTicketSchema } from '@/lib/validations'
import { useAuth } from '@/hooks/useAuth'
import { api as convexApi } from '@/lib/convex-api'
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
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/_authenticated/tickets/$ticketId/edit')({
  component: EditTicketPage,
})

function EditTicketPage() {
  const navigate = useNavigate()
  const { ticketId } = Route.useParams()
  const { user, isAuthenticated } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const filesRef = useRef<Array<FileWithPreview>>([])
  const originalPhotoIdsRef = useRef<Array<string>>([]) // Track original photo IDs to detect removals

  // Use Convex query for real-time ticket data
  const ticketResult = useQuery(
    convexApi.functions.tickets.queries.getById,
    user?.id && isAuthenticated && ticketId
      ? { ticketId: ticketId as any, userId: user.id as any }
      : 'skip'
  )

  // Use Convex mutation for updating tickets
  const updateTicket = useMutation(convexApi.functions.tickets.mutations.update)

  // Handle loading and error states
  const isLoading = ticketResult === undefined && isAuthenticated
  const ticket = ticketResult || null

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

  // Pre-fill form when ticket data loads
  useEffect(() => {
    if (!ticket) return

    // Check if ticket can be edited
    const editableStatuses = ['pending', 'analyzed', 'processing', 'vendors_available']
    if (!editableStatuses.includes(ticket.status)) {
      setSubmitError(
        `This ticket cannot be edited. Current status: ${ticket.status}. Only tickets with status: ${editableStatuses.join(', ')} can be edited.`
      )
      return
    }

    // Pre-fill form with ticket data
    form.reset({
      description: ticket.description,
      location: ticket.location || '',
      name: ticket.name || user?.name || '',
      photoIds: ticket.photoIds,
      urgency: ticket.urgency,
    })

    // Pre-fill files with existing images
    if (ticket.photoUrls && ticket.photoIds) {
      const existingFiles: Array<FileWithPreview> = []
      
      // Store original photo IDs for comparison later
      originalPhotoIdsRef.current = [...ticket.photoIds]
      
      for (let index = 0; index < ticket.photoIds.length; index++) {
        const photoId = ticket.photoIds[index]
        const photoUrl = ticket.photoUrls[index]
        
        if (photoUrl) {
          existingFiles.push({
            file: {
              id: photoId,
              name: `photo-${index + 1}.jpg`,
              size: 0,
              type: 'image/jpeg',
              url: photoUrl,
            } as FileMetadata,
            id: photoId,
            preview: photoUrl,
          })
        }
      }
      
      filesRef.current = existingFiles
    }
  }, [ticket, form, user])

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
    if (!ticket) return

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

      // Get IDs from already uploaded files (files that remain)
      const remainingIds = filesRef.current
        .filter(f => !(f.file instanceof File))
        .map(f => {
          const fileMetadata = f.file as { id: string }
          return fileMetadata.id
        })

      // Combine all photo IDs
      const allPhotoIds = [...remainingIds, ...uploadedIds]

      if (allPhotoIds.length === 0) {
        setSubmitError('At least one photo is required')
        return
      }

      // Find removed photo IDs (photos that were in original but not in current)
      const removedPhotoIds = originalPhotoIdsRef.current.filter(
        originalId => !allPhotoIds.includes(originalId)
      )

      // Update ticket using Convex mutation (handles file deletion internally)
      await updateTicket({
        ticketId: ticketId as any,
        userId: user!.id as any,
        description: data.description,
        photoIds: allPhotoIds as any,
        location: data.location || undefined,
        name: data.name || undefined,
        urgency: data.urgency || undefined,
        removedPhotoIds: removedPhotoIds.length > 0 ? (removedPhotoIds as any) : undefined,
      })

      // Show success toast
      toast.success('Ticket Updated Successfully', {
        description: 'Your maintenance request has been updated.',
        duration: 4000,
      })
      
      // Redirect to tickets page after a short delay
      setTimeout(() => {
        navigate({ to: '/tickets' })
      }, 1000)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to update ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <main className="flex items-center justify-center h-full">
        <Spinner className="size-8" />
      </main>
    )
  }

  // Show error state
  if (ticketResult === null || (submitError && !ticket)) {
    return (
      <main className="flex items-center justify-center h-full p-4">
        <Alert variant="destructive" className="max-w-md">
          <TriangleAlert className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {submitError || 'Failed to load ticket'}
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  if (!ticket) {
    return (
      <main className="flex items-center justify-center h-full p-4">
        <Alert className="max-w-md">
          <AlertDescription>Ticket not found</AlertDescription>
        </Alert>
      </main>
    )
  }

  return (
    <>
      <main className="flex flex-col items-center gap-6 p-4 md:p-6 lg:p-8 overflow-y-auto max-h-full">
        <Card className="border-0 rounded-2xl shadow-none max-w-[500px]">
          <CardHeader>
            <CardTitle>Edit Ticket</CardTitle>
            <CardDescription>
              Update information about the issue and photos.
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
                          initialFiles={ticket.photoUrls?.map((url, index) => ({
                            id: ticket.photoIds[index],
                            name: `photo-${index + 1}.jpg`,
                            size: 0,
                            type: 'image/jpeg',
                            url: url || '',
                          })).filter(f => f.url) || []}
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
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
      
      <FormFooter
        onSubmit={handleSubmit}
        onCancel={() => navigate({ to: '/tickets' })}
        isSubmitting={isSubmitting}
        submitLabel="Save Changes"
        cancelLabel="Cancel"
      />
    </>
  )
}
