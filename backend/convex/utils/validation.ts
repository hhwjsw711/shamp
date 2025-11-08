/**
 * Validation utilities using Zod schemas for input validation
 */

import { z } from "zod";
import { ValidationError } from "./errors";

/**
 * Email validation schema
 */
export const emailSchema = z.string().email("Invalid email format").min(1).max(255);

/**
 * Password validation schema
 * Requirements: min 8 characters, at least one letter and one number
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .max(128, "Password must be less than 128 characters");

/**
 * Pin validation schema (6-digit pin)
 */
export const pinSchema = z
  .string()
  .regex(/^\d{6}$/, "Pin must be exactly 6 digits")
  .length(6, "Pin must be exactly 6 digits");

/**
 * Name validation schema
 */
export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be less than 100 characters")
  .regex(/^[a-zA-Z\s'-]+$/, "Name contains invalid characters");

/**
 * Organization name validation schema
 */
export const orgNameSchema = z
  .string()
  .min(1, "Organization name is required")
  .max(200, "Organization name must be less than 200 characters");

/**
 * Location validation schema
 */
export const locationSchema = z
  .string()
  .min(1, "Location is required")
  .max(500, "Location must be less than 500 characters");

/**
 * Login request schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

/**
 * Register request schema
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema.optional(),
  orgName: orgNameSchema.optional(),
  location: locationSchema.optional(),
});

/**
 * Pin login request schema
 */
export const pinLoginSchema = z.object({
  pin: pinSchema,
});

/**
 * Update password request schema
 */
export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

/**
 * Update pin request schema
 */
export const updatePinSchema = z.object({
  currentPin: pinSchema.optional(),
  newPin: pinSchema,
});

/**
 * Update user profile schema
 */
export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  orgName: orgNameSchema.optional(),
  location: locationSchema.optional(),
});

/**
 * Validate data against a Zod schema
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated data
 * @throws ValidationError if validation fails
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues;
    const firstError = errors[0];
    throw new ValidationError(
      firstError.message,
      firstError.path.join(".")
    );
  }
  
  return result.data;
}

/**
 * Validate email format
 * @param email - Email to validate
 * @throws ValidationError if invalid
 */
export function validateEmail(email: string): void {
  emailSchema.parse(email);
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @throws ValidationError if invalid
 */
export function validatePassword(password: string): void {
  passwordSchema.parse(password);
}

/**
 * Validate pin format
 * @param pin - Pin to validate
 * @throws ValidationError if invalid
 */
export function validatePin(pin: string): void {
  pinSchema.parse(pin);
}

