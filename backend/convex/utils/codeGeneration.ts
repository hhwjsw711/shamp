/**
 * Utilities for generating and validating 6-digit verification codes
 */

/**
 * Generates a random 6-digit code
 * @returns A 6-digit string code (e.g., "123456")
 */
export function generateSixDigitCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

/**
 * Validates that a code is a 6-digit string
 * @param code - The code to validate
 * @returns True if the code is valid, false otherwise
 */
export function isValidCodeFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Calculates expiration timestamp for a code
 * @param expiryMinutes - Number of minutes until expiration (default: 15)
 * @returns Unix timestamp in milliseconds
 */
export function getCodeExpiration(expiryMinutes: number = 15): number {
  return Date.now() + expiryMinutes * 60 * 1000;
}

/**
 * Checks if a code has expired
 * @param expiresAt - Expiration timestamp in milliseconds
 * @returns True if expired, false otherwise
 */
export function isCodeExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

