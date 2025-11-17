/**
 * Format Phone Number Utility
 * Formats phone numbers from Firecrawl results to E.164 format for Vapi
 * Handles various formats: (732) 733-2541, 732-733-2541, 732.733.2541, etc.
 */

/**
 * Format phone number to E.164 format (e.g., +17327332541)
 * Vapi requires phone numbers in E.164 format
 */
export function formatPhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // If it starts with +, keep it
  const hasPlus = cleaned.startsWith("+");
  if (hasPlus) {
    cleaned = cleaned.substring(1);
  }

  // Remove leading 1 if present (US country code)
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    cleaned = cleaned.substring(1);
  }

  // Must be 10 digits for US phone numbers
  if (cleaned.length !== 10) {
    console.warn(`Invalid phone number length: ${phone} (cleaned: ${cleaned})`);
    return null;
  }

  // Format as E.164: +1XXXXXXXXXX
  return `+1${cleaned}`;
}

/**
 * Validate if phone number is callable
 * Checks if it's in a valid format for Vapi
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const formatted = formatPhoneNumber(phone);
  return formatted !== null;
}

