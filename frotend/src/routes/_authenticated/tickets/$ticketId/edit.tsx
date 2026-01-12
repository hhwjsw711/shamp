import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { FileMetadata, FileWithPreview } from '@/hooks/use-file-upload'
import type { CreateTicketInput } from '@/lib/validations'
import { createValidationSchemas } from '@/lib/validations'
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
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const filesRef = useRef<Array<FileWithPreview>>([])
  const originalPhotoIdsRef = useRef<Array<string>>([]) // Track original photo IDs to detect removals

  // Create validation schemas with translations
  const schemas = useMemo(() => createValidationSchemas(t), [t])

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
    resolver: zodResolver(schemas.createTicketSchema),
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
    const editableStatuses = ['analyzed', 'reviewed']
    if (!editableStatuses.includes(ticket.status)) {
      setSubmitError(
        t($ => $.tickets.edit.notEditable, {
          status: ticket.status,
          statuses: editableStatuses.join(', ')
        })
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
        setSubmitError(t($ => $.tickets.edit.photosRequired))
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
      toast.success(t($ => $.tickets.edit.successToast), {
        description: t($ => $.tickets.edit.successDescription),
        duration: 4000,
      })
      
      // Redirect to ticket details page after a short delay
      setTimeout(() => {
        navigate({ to: `/tickets/${ticketId}` })
      }, 1000)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t($ => $.tickets.edit.error))
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
          <AlertTitle>{t($ => $.common.messages.error)}</AlertTitle>
          <AlertDescription>
            {submitError || t($ => $.tickets.edit.loadError)}
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  if (!ticket) {
    return (
      <main className="flex items-center justify-center h-full p-4">
        <Alert className="max-w-md">
          <AlertDescription>{t($ => $.tickets.edit.notFound)}</AlertDescription>
        </Alert>
      </main>
    )
  }

  return (
    <>
      <main className="flex flex-col items-center gap-6 p-4 md:p-6 lg:p-8 overflow-y-auto max-h-full">
        <Card className="border-0 rounded-2xl shadow-none max-w-[500px]">
          <CardHeader>
            <CardTitle>{t($ => $.tickets.edit.title)}</CardTitle>
            <CardDescription>
              {t($ => $.tickets.edit.subtitle)}
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
                      <FormLabel>{t($ => $.tickets.form.photosLabel)}</FormLabel>
                      <FormDescription>
                        {t($ => $.tickets.form.photosDescription)}
                      </FormDescription>
                      <FormControl>
                        <GalleryUpload
                          maxFiles={5}
                          maxSize={10 * 1024 * 1024} // 10MB
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                          multiple={true}
                          onFilesChange={handleFilesChange}
                          initialFiles={
                            (ticket.photoUrls ?? [])
                              .map((url: string | null, index: number) => {
                                const safeUrl = url ?? ''
                                if (!safeUrl) return null
                                return {
                                  id: ticket.photoIds[index],
                                  name: `photo-${index + 1}.jpg`,
                                  size: 0,
                                  type: 'image/jpeg',
                                  url: safeUrl,
                                }
                              })
                              .filter(
                                (
                                  f: {
                                    id: string
                                    name: string
                                    size: number
                                    type: string
                                    url: string
                                  } | null
                                ): f is {
                                  id: string
                                  name: string
                                  size: number
                                  type: string
                                  url: string
                                } => Boolean(f?.url)
                              ) ?? []
                          }
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
                      <FormLabel>{t($ => $.tickets.form.descriptionLabel)}</FormLabel>
                      <FormDescription>
                        {t($ => $.tickets.form.descriptionDescription)}
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
                      <FormLabel>{t($ => $.tickets.form.locationLabel)}</FormLabel>
                      <FormDescription>
                        {t($ => $.tickets.form.locationDescription)}
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
                      <FormLabel>{t($ => $.tickets.form.urgencyLabel)}</FormLabel>
                      <FormDescription>
                        {t($ => $.tickets.form.urgencyDescription)}
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
                              {t($ => $.tickets.form.urgencyEmergency)}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="urgent" id="urgency-urgent" />
                            <Label htmlFor="urgency-urgent" className="font-normal cursor-pointer">
                              {t($ => $.tickets.form.urgencyUrgent)}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="normal" id="urgency-normal" />
                            <Label htmlFor="urgency-normal" className="font-normal cursor-pointer">
                              {t($ => $.tickets.form.urgencyNormal)}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="low" id="urgency-low" />
                            <Label htmlFor="urgency-low" className="font-normal cursor-pointer">
                              {t($ => $.tickets.form.urgencyLow)}
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
                    <AlertTitle>{t($ => $.common.messages.error)}</AlertTitle>
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
        submitLabel={t($ => $.tickets.edit.submitButton)}
        cancelLabel={t($ => $.tickets.edit.cancelButton)}
      />
    </>
  )
}
