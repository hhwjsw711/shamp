/**
 * Validation utilities using Zod schemas for input validation
 */

import { z } from "zod";
import { ValidationError } from "./errors";

/**
 * Email validation schema with detailed error messages
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(255, "Email must be less than 255 characters")
  .email("Please enter a valid email address");

/**
 * Password validation schema with detailed error messages
 * Requirements: min 8 characters, at least one letter and one number
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be less than 128 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/^[^\s]+$/, "Password cannot contain spaces");

/**
 * Pin validation schema (6-digit pin)
 */
export const pinSchema = z
  .string()
  .regex(/^\d{6}$/, "Pin must be exactly 6 digits")
  .length(6, "Pin must be exactly 6 digits");

/**
 * Name validation schema
 * Supports all Unicode characters (Chinese, Japanese, Korean, etc.)
 */
export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be less than 100 characters")
  .regex(/^[\p{L}\p{M}\s'-]+$/u, "Name contains invalid characters");

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
 * Register request schema (email and password only)
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

/**
 * 6-digit code validation schema (for email verification and password reset)
 */
export const sixDigitCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Verification code must be exactly 6 digits");

/**
 * Email verification code schema
 */
export const emailVerificationCodeSchema = z.object({
  code: sixDigitCodeSchema,
});

/**
 * Password reset verify schema
 */
export const passwordResetVerifySchema = z.object({
  code: sixDigitCodeSchema,
});

/**
 * Password reset complete schema
 */
export const passwordResetCompleteSchema = z.object({
  userId: z.string(), // User ID from verification step (code is deleted after verification)
  newPassword: passwordSchema,
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
 * Validate data against a Zod schema and return user-friendly error messages
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated data
 * @throws ValidationError with user-friendly message if validation fails
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues;
    // Get the first error with the most specific message
    const firstError = errors[0];
    
    // Build a user-friendly error message
    const field = firstError.path.length > 0 
      ? `${firstError.path.join(".")}: ` 
      : "";
    
    throw new ValidationError(
      `${field}${firstError.message}`,
      firstError.path.join(".")
    );
  }
  
  return result.data;
}

/**
 * Validate email format with user-friendly error message
 * @param email - Email to validate
 * @throws ValidationError with user-friendly message if invalid
 */
export function validateEmail(email: string): void {
  try {
    emailSchema.parse(email);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        error.issues[0].message,
        "email"
      );
    }
    throw error;
  }
}

/**
 * Validate password strength with user-friendly error message
 * @param password - Password to validate
 * @throws ValidationError with user-friendly message if invalid
 */
export function validatePassword(password: string): void {
  try {
    passwordSchema.parse(password);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        error.issues[0].message,
        "password"
      );
    }
    throw error;
  }
}

/**
 * Validate pin format
 * @param pin - Pin to validate
 * @throws ValidationError if invalid
 */
export function validatePin(pin: string): void {
  pinSchema.parse(pin);
}

