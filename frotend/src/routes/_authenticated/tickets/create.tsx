import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { FileWithPreview } from '@/hooks/use-file-upload'
import type { CreateTicketInput } from '@/lib/validations'
import { createValidationSchemas } from '@/lib/validations'
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
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const filesRef = useRef<Array<FileWithPreview>>([])

  // Create validation schemas with translations
  const schemas = useMemo(() => createValidationSchemas(t), [t])

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
    const formData = new FormData()
    formData.append('file', file)

    // Use relative URL to go through the API proxy (same-origin request)
    // This ensures cookies are automatically included
    const config: RequestInit = {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }

    const response = await fetch('/api/files/upload', config)

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
        setSubmitError(t($ => $.tickets.create.photosRequired))
        return
      }

      // Submit ticket with photo IDs
      const response = await api.tickets.create({
        description: data.description,
        photoIds: allPhotoIds,
        location: data.location || undefined,
        name: data.name || undefined,
        urgency: data.urgency || undefined,
      })

      // Show success toast
      toast.success(t($ => $.tickets.create.successToast), {
        description: t($ => $.tickets.create.successDescription),
        duration: 4000,
      })
      
      // Redirect to ticket details page after a short delay
      if (response?.ticket?._id) {
        setTimeout(() => {
          navigate({ to: `/tickets/${response.ticket._id}` })
        }, 1000)
      } else {
        // Fallback to tickets list if ticket ID not available
        setTimeout(() => {
          navigate({ to: '/tickets' })
        }, 1000)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t($ => $.tickets.create.error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <main className="flex flex-col items-center gap-6 p-4 md:p-6 lg:p-8 overflow-y-auto max-h-full">
      

      <Card className="border-0 rounded-2xl shadow-none max-w-[500px]">
        <CardHeader>
          <CardTitle>{t($ => $.tickets.create.title)}</CardTitle>
          <CardDescription>
            {t($ => $.tickets.create.subtitle)}
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
        submitLabel={t($ => $.tickets.create.submitButton)}
        cancelLabel={t($ => $.tickets.create.cancelButton)}
      />
    </>
  )
}

