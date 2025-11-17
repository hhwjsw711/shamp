/**
 * Zod validation schemas matching backend validation
 */

import { z } from 'zod'

// Email validation schema
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address')

// Password validation schema
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  )

// Registration schema
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

// Login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

// Email verification schema
export const emailVerificationSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d+$/, 'Code must contain only digits'),
})

// Password reset request schema
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
})

// Password reset verify schema
export const passwordResetVerifySchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d+$/, 'Code must contain only digits'),
})

// Password reset complete schema
export const passwordResetCompleteSchema = z
  .object({
    userId: z.string().min(1, 'User ID is required'), // User ID from verification step
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

// Onboarding schema
export const onboardingSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  orgName: z
    .string()
    .min(1, 'Organization name is required')
    .max(100, 'Organization name must be less than 100 characters'),
  location: z
    .string()
    .min(1, 'Location is required')
    .max(200, 'Location must be less than 200 characters'),
})

// Ticket creation schema
export const createTicketSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  photoIds: z.array(z.string()).min(1, 'At least one photo is required').max(5, 'Maximum 5 photos allowed'),
  location: z.string().optional(),
  name: z.string().optional(),
  urgency: z.enum(['emergency', 'urgent', 'normal', 'low']).optional(),
})

// Vendor creation schema
export const createVendorSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  email: emailSchema,
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>
export type PasswordResetVerifyInput = z.infer<
  typeof passwordResetVerifySchema
>
export type PasswordResetCompleteInput = z.infer<
  typeof passwordResetCompleteSchema
>
export type OnboardingInput = z.infer<typeof onboardingSchema>
export type CreateTicketInput = z.infer<typeof createTicketSchema>
export type CreateVendorInput = z.infer<typeof createVendorSchema>

