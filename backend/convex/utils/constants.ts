/**
 * Constants used throughout the application
 */

// Session configuration
export const SESSION_EXPIRY_DAYS = 7;
export const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// Code expiration (6-digit codes)
export const CODE_EXPIRY_MINUTES = 15;
export const CODE_EXPIRY_MS = CODE_EXPIRY_MINUTES * 60 * 1000;

// Rate limiting
export const PIN_ATTEMPT_LIMIT = 5;
export const PIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Email verification
export const EMAIL_VERIFICATION_CODE_LENGTH = 6;
export const PASSWORD_RESET_CODE_LENGTH = 6;

// Ticket statuses
export const TICKET_STATUS = {
  NEW: "new",
  UNDER_REVIEW: "under_review",
  VENDOR_ASSIGNED: "vendor_assigned",
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in_progress",
  FIXED: "fixed",
  CLOSED: "closed",
} as const;

// Quote statuses
export const QUOTE_STATUS = {
  AWAITING_QUOTES: "awaiting_quotes",
  QUOTES_RECEIVED: "quotes_received",
  VENDOR_SELECTED: "vendor_selected",
  SCHEDULING: "scheduling",
} as const;

// Vendor outreach statuses
export const OUTREACH_STATUS = {
  SENT: "sent",
  DELIVERED: "delivered",
  OPENED: "opened",
  RESPONDED: "responded",
  BOUNCED: "bounced",
  EXPIRED: "expired",
} as const;

// Vendor quote statuses
export const VENDOR_QUOTE_STATUS = {
  PENDING: "pending",
  RECEIVED: "received",
  SELECTED: "selected",
  REJECTED: "rejected",
  EXPIRED: "expired",
} as const;

// Email statuses
export const EMAIL_STATUS = {
  VALID: "valid",
  INVALID: "invalid",
  BOUNCED: "bounced",
  COMPLAINED: "complained",
  DO_NOT_EMAIL: "doNotEmail",
} as const;

// Embedding dimensions
export const EMBEDDING_DIMENSIONS = 1536;

// File upload limits
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

