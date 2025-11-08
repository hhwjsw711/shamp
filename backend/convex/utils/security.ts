/**
 * Security utilities for CSRF protection, rate limiting, and input sanitization
 */

import { RateLimitError } from "./errors";

/**
 * Simple in-memory rate limiter (for development)
 * In production, consider using Redis or Convex storage
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

/**
 * Check rate limit for an identifier (IP, user ID, etc.)
 * @param identifier - Unique identifier for rate limiting
 * @param config - Rate limit configuration
 * @throws RateLimitError if rate limit exceeded
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): void {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    // Reset or create new record
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return;
  }

  if (record.count >= config.maxAttempts) {
    const remainingSeconds = Math.ceil((record.resetAt - now) / 1000);
    throw new RateLimitError(
      `Too many requests. Please try again in ${remainingSeconds} seconds.`
    );
  }

  // Increment count
  record.count++;
}

/**
 * Clear rate limit for an identifier
 * @param identifier - Unique identifier
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Sanitize string input to prevent XSS
 * @param input - Input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove angle brackets
    .trim()
    .slice(0, 10000); // Limit length
}

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Extract IP address from request headers
 * @param headers - Request headers
 * @returns IP address or null
 */
export function extractIpAddress(headers: Headers): string | null {
  // Check various headers for IP address
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return null;
}

/**
 * Extract user agent from request headers
 * @param headers - Request headers
 * @returns User agent string or null
 */
export function extractUserAgent(headers: Headers): string | null {
  return headers.get("user-agent");
}

/**
 * Generate CSRF token (simple implementation)
 * In production, use a more secure method
 * @returns CSRF token
 */
export function generateCsrfToken(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Validate CSRF token
 * @param token - Token to validate
 * @param expectedToken - Expected token
 * @returns True if tokens match
 */
export function validateCsrfToken(token: string, expectedToken: string): boolean {
  return token === expectedToken && token.length > 0;
}

