/**
 * Zod validation schemas with i18n support
 */

import { z } from 'zod'
import type { TFunction } from 'i18next'

/**
 * Creates validation schemas with internationalized error messages
 * @param t - Translation function from useTranslation hook
 * @returns Object containing all validation schemas
 */
export function createValidationSchemas(t: TFunction) {
  // Email validation schema
  const emailSchema = z
    .string()
    .min(1, t($ => $.validation.email.required))
    .email(t($ => $.validation.email.invalid))

  // Password validation schema
  const passwordSchema = z
    .string()
    .min(8, t($ => $.validation.password.min))
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      t($ => $.validation.password.complexity)
    )

  // Registration schema
  const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
  })

  // Login schema
  const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, t($ => $.validation.password.required)),
  })

  // Email verification schema
  const emailVerificationSchema = z.object({
    email: emailSchema,
    code: z
      .string()
      .length(6, t($ => $.validation.code.length, { length: 6 }))
      .regex(/^\d+$/, t($ => $.validation.code.digitsOnly)),
  })

  // Password reset request schema
  const passwordResetRequestSchema = z.object({
    email: emailSchema,
  })

  // Password reset verify schema
  const passwordResetVerifySchema = z.object({
    email: emailSchema,
    code: z
      .string()
      .length(6, t($ => $.validation.code.length, { length: 6 }))
      .regex(/^\d+$/, t($ => $.validation.code.digitsOnly)),
  })

  // Password reset complete schema
  const passwordResetCompleteSchema = z
    .object({
      userId: z.string().min(1, t($ => $.validation.userId.required)),
      newPassword: passwordSchema,
      confirmPassword: z.string().min(1, t($ => $.validation.password.confirm)),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t($ => $.validation.password.match),
      path: ['confirmPassword'],
    })

  // Onboarding schema
  const onboardingSchema = z.object({
    name: z
      .string()
      .min(1, t($ => $.validation.name.required))
      .max(100, t($ => $.validation.name.max)),
    orgName: z
      .string()
      .min(1, t($ => $.validation.orgName.required))
      .max(100, t($ => $.validation.orgName.max)),
    location: z
      .string()
      .min(1, t($ => $.validation.location.required))
      .max(200, t($ => $.validation.location.max)),
  })

  // Ticket creation schema
  const createTicketSchema = z.object({
    description: z.string().min(1, t($ => $.validation.description.required)),
    photoIds: z
      .array(z.string())
      .min(1, t($ => $.validation.photos.required))
      .max(5, t($ => $.validation.photos.max)),
    location: z.string().optional(),
    name: z.string().optional(),
    urgency: z.enum(['emergency', 'urgent', 'normal', 'low']).optional(),
  })

  // Vendor creation schema
  const createVendorSchema = z.object({
    businessName: z.string().min(1, t($ => $.validation.businessName.required)),
    email: emailSchema,
    phone: z.string().optional(),
    website: z.string().url(t($ => $.validation.website.invalid)).optional().or(z.literal('')),
    address: z.string().optional(),
  })

  return {
    emailSchema,
    passwordSchema,
    registerSchema,
    loginSchema,
    emailVerificationSchema,
    passwordResetRequestSchema,
    passwordResetVerifySchema,
    passwordResetCompleteSchema,
    onboardingSchema,
    createTicketSchema,
    createVendorSchema,
  }
}

// Type exports
export type RegisterInput = z.infer<ReturnType<typeof createValidationSchemas>['registerSchema']>
export type LoginInput = z.infer<ReturnType<typeof createValidationSchemas>['loginSchema']>
export type EmailVerificationInput = z.infer<ReturnType<typeof createValidationSchemas>['emailVerificationSchema']>
export type PasswordResetRequestInput = z.infer<ReturnType<typeof createValidationSchemas>['passwordResetRequestSchema']>
export type PasswordResetVerifyInput = z.infer<ReturnType<typeof createValidationSchemas>['passwordResetVerifySchema']>
export type PasswordResetCompleteInput = z.infer<ReturnType<typeof createValidationSchemas>['passwordResetCompleteSchema']>
export type OnboardingInput = z.infer<ReturnType<typeof createValidationSchemas>['onboardingSchema']>
export type CreateTicketInput = z.infer<ReturnType<typeof createValidationSchemas>['createTicketSchema']>
export type CreateVendorInput = z.infer<ReturnType<typeof createValidationSchemas>['createVendorSchema']>

