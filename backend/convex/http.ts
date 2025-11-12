/**
 * HTTP Router for Shamp backend
 * Handles all HTTP endpoints and routes them to appropriate handlers
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { corsRouter } from "convex-helpers/server/cors";

// Import auth handlers
import { getGoogleAuthUrlHandler, googleCallbackHandler } from "./handlers/auth/google";
import { loginHandler } from "./handlers/auth/login";
import { registerHandler } from "./handlers/auth/register";
import { meHandler } from "./handlers/auth/me";
import { logoutHandler } from "./handlers/auth/logout";
import { completeOnboardingHandler } from "./handlers/auth/onboarding";
import { validatePinHandler } from "./handlers/auth/validatePin";

// Import email verification handlers
import { sendCodeHandler, verifyCodeHandler } from "./handlers/emailVerification/sendCode";

// Import password reset handlers
import { requestPasswordResetHandler } from "./handlers/passwordReset/request";
import { verifyPasswordResetCodeHandler } from "./handlers/passwordReset/verify";
import { completePasswordResetHandler } from "./handlers/passwordReset/complete";

// Import ticket handlers
import {
  createTicketHandler,
  getTicketByIdHandler,
  listTicketsHandler,
  updateTicketHandler,
  updateTicketStatusHandler,
  assignVendorHandler,
  closeTicketHandler,
  scheduleRepairHandler,
  deleteTicketHandler,
  deletePhotoFromTicketHandler,
} from "./handlers/tickets/index";
import { updateVendorStatusHandler } from "./handlers/tickets/vendorStatus";
import { uploadAfterPhotosHandler } from "./handlers/tickets/afterPhotos";
import { updateGuestImpactHandler } from "./handlers/tickets/guestImpact";
import { submitTicketWithPinHandler } from "./handlers/tickets/submitWithPin";

// Import vendor handlers
import {
  createVendorHandler,
  getVendorByIdHandler,
  listVendorsHandler,
  updateVendorHandler,
} from "./handlers/vendors/index";

// Import vendor quotes handlers
import {
  listVendorQuotesHandler,
  getVendorQuoteByIdHandler,
} from "./handlers/vendorQuotes/index";

// Import conversation handlers
import {
  createConversationHandler,
  getConversationByIdHandler,
  getConversationByTicketIdHandler,
  addMessageHandler,
} from "./handlers/conversations/index";

// Import agent handlers
import {
  analyzeTicketHandler,
  discoverVendorsHandler,
  discoverVendorsStreamHandler,
  sendOutreachEmailsHandler,
  rankVendorsHandler,
  selectVendorHandler,
} from "./handlers/agents/index";

// Import email handlers
import { handleInboundEmail } from "./handlers/emails/inbound";
import { handleWebhook } from "./handlers/emails/webhook";

// Import analytics handlers
import { getDashboardStatsHandler } from "./handlers/analytics/index";

// Import chat handlers
import { chatHandler } from "./handlers/chat/index";

// Import file handlers
import {
  uploadFileHandler,
  getFileUrlHandler,
  deleteFileHandler,
} from "./handlers/files/index";

const http = httpRouter();

/**
 * CORS Router Configuration
 * Uses convex-helpers corsRouter which automatically handles OPTIONS preflight requests
 * including for parameterized routes like /api/tickets/:id
 */
const cors = corsRouter(http, {
  // Dynamic origin handling: use request origin if present
  // Note: Cannot use "*" with allowCredentials: true, so we must return the actual origin
  allowedOrigins: async (req: Request) => {
    const origin = req.headers.get("origin");
    if (origin) {
      return [origin];
    }
    // If no origin header (e.g., same-origin request), allow it
    // This handles cases where requests come from the same domain
    return [];
  },
  allowedHeaders: ["Content-Type", "Authorization"],
  allowCredentials: true,
  browserCacheMaxAge: 86400, // 24 hours
});

/**
 * Catch-all OPTIONS handler for parameterized routes
 * This ensures OPTIONS requests are handled even if corsRouter has issues with parameterized routes
 */
http.route({
  path: "/api/tickets/:id",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const origin = request.headers.get("origin");
    // Must return actual origin, cannot use "*" with allowCredentials: true
    const allowedOrigin = origin || request.headers.get("referer")?.split("/").slice(0, 3).join("/") || "https://hoveringly-undelineable-fausto.ngrok-free.dev";
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

/**
 * Health check endpoint (no CORS needed)
 */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({ status: "ok", timestamp: Date.now() }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }),
});

/**
 * Authentication Routes
 * All routes use cors.route() which automatically handles OPTIONS preflight requests
 */

// Get Google OAuth URL
cors.route({
  path: "/api/auth/google/url",
  method: "GET",
  handler: getGoogleAuthUrlHandler,
});

// Google OAuth callback
// Note: Google OAuth redirects to /api/auth/callback/google (not /api/auth/google/callback)
cors.route({
  path: "/api/auth/callback/google",
  method: "GET",
  handler: googleCallbackHandler,
});

// Email/password login
cors.route({
  path: "/api/auth/login",
  method: "POST",
  handler: loginHandler,
});

// Email/password registration
cors.route({
  path: "/api/auth/register",
  method: "POST",
  handler: registerHandler,
});

// Get current user
cors.route({
  path: "/api/auth/me",
  method: "GET",
  handler: meHandler,
});

// Logout
cors.route({
  path: "/api/auth/logout",
  method: "POST",
  handler: logoutHandler,
});

// Email verification routes
cors.route({
  path: "/api/auth/email-verification/send-code",
  method: "POST",
  handler: sendCodeHandler,
});

cors.route({
  path: "/api/auth/email-verification/verify-code",
  method: "POST",
  handler: verifyCodeHandler,
});

// Password reset routes
cors.route({
  path: "/api/auth/password-reset/request",
  method: "POST",
  handler: requestPasswordResetHandler,
});

cors.route({
  path: "/api/auth/password-reset/verify",
  method: "POST",
  handler: verifyPasswordResetCodeHandler,
});

cors.route({
  path: "/api/auth/password-reset/complete",
  method: "POST",
  handler: completePasswordResetHandler,
});

// Onboarding route
cors.route({
  path: "/api/auth/onboarding",
  method: "POST",
  handler: completeOnboardingHandler,
});

// PIN validation route
cors.route({
  path: "/api/auth/validate-pin",
  method: "POST",
  handler: validatePinHandler,
});

/**
 * Ticket Routes
 * All routes use cors.route() which automatically handles OPTIONS preflight requests
 * including parameterized routes like /api/tickets/:id
 */

// Create ticket
cors.route({
  path: "/api/tickets",
  method: "POST",
  handler: createTicketHandler,
});

// List tickets
cors.route({
  path: "/api/tickets",
  method: "GET",
  handler: listTicketsHandler,
});

// Get ticket by ID
cors.route({
  path: "/api/tickets/:id",
  method: "GET",
  handler: getTicketByIdHandler,
});

// Update ticket
cors.route({
  path: "/api/tickets/:id",
  method: "PATCH",
  handler: updateTicketHandler,
});

// Delete ticket
cors.route({
  path: "/api/tickets/:id",
  method: "DELETE",
  handler: deleteTicketHandler,
});

// Update ticket status
cors.route({
  path: "/api/tickets/:id/status",
  method: "PATCH",
  handler: updateTicketStatusHandler,
});

// Assign vendor to ticket
cors.route({
  path: "/api/tickets/:id/assign-vendor",
  method: "POST",
  handler: assignVendorHandler,
});

// Close ticket
cors.route({
  path: "/api/tickets/:id/close",
  method: "POST",
  handler: closeTicketHandler,
});

// Schedule repair
cors.route({
  path: "/api/tickets/:id/schedule",
  method: "POST",
  handler: scheduleRepairHandler,
});

// Delete photo from ticket
cors.route({
  path: "/api/tickets/:id/photos/:photoId",
  method: "DELETE",
  handler: deletePhotoFromTicketHandler,
});

// Submit ticket with PIN (for staff/guests)
cors.route({
  path: "/api/tickets/submit-with-pin",
  method: "POST",
  handler: submitTicketWithPinHandler,
});

// Update vendor status
cors.route({
  path: "/api/tickets/:id/vendor-status",
  method: "PATCH",
  handler: updateVendorStatusHandler,
});

// Upload after photos
cors.route({
  path: "/api/tickets/:id/after-photos",
  method: "POST",
  handler: uploadAfterPhotosHandler,
});

// Update guest impact
cors.route({
  path: "/api/tickets/:id/guest-impact",
  method: "PATCH",
  handler: updateGuestImpactHandler,
});

/**
 * Vendor Routes
 */

// Create vendor
http.route({
  path: "/api/vendors",
  method: "POST",
  handler: createVendorHandler,
});

// List vendors
http.route({
  path: "/api/vendors",
  method: "GET",
  handler: listVendorsHandler,
});

// Get vendor by ID
http.route({
  path: "/api/vendors/get",
  method: "GET",
  handler: getVendorByIdHandler,
});

// Update vendor
http.route({
  path: "/api/vendors/update",
  method: "PATCH",
  handler: updateVendorHandler,
});

/**
 * Vendor Quotes Routes
 * All routes use cors.route() which automatically handles OPTIONS preflight requests
 */

// List vendor quotes
cors.route({
  path: "/api/vendor-quotes",
  method: "GET",
  handler: listVendorQuotesHandler,
});

// Get vendor quote by ID
cors.route({
  path: "/api/vendor-quotes/:id",
  method: "GET",
  handler: getVendorQuoteByIdHandler,
});

/**
 * Conversation Routes
 */

// Create conversation
http.route({
  path: "/api/conversations",
  method: "POST",
  handler: createConversationHandler,
});

// Get conversation by ID
http.route({
  path: "/api/conversations/get",
  method: "GET",
  handler: getConversationByIdHandler,
});

// Get conversation by ticket ID
http.route({
  path: "/api/conversations/by-ticket",
  method: "GET",
  handler: getConversationByTicketIdHandler,
});

// Add message to conversation
http.route({
  path: "/api/conversations/messages",
  method: "POST",
  handler: addMessageHandler,
});

/**
 * Agent Routes
 */

// Analyze ticket
http.route({
  path: "/api/agents/analyze-ticket",
  method: "POST",
  handler: analyzeTicketHandler,
});

// Discover vendors (non-streaming)
http.route({
  path: "/api/agents/discover-vendors",
  method: "POST",
  handler: discoverVendorsHandler,
});

// Discover vendors (streaming)
cors.route({
  path: "/api/agents/discover-vendors/stream",
  method: "POST",
  handler: discoverVendorsStreamHandler,
});

// Send outreach emails
http.route({
  path: "/api/agents/send-outreach-emails",
  method: "POST",
  handler: sendOutreachEmailsHandler,
});

// Rank vendors
http.route({
  path: "/api/agents/rank-vendors",
  method: "POST",
  handler: rankVendorsHandler,
});

// Select vendor
http.route({
  path: "/api/agents/select-vendor",
  method: "POST",
  handler: selectVendorHandler,
});

/**
 * Email Webhook Routes
 */

// Handle inbound email replies
http.route({
  path: "/api/emails/inbound",
  method: "POST",
  handler: handleInboundEmail,
});

// Handle Resend webhook events
http.route({
  path: "/api/emails/webhook",
  method: "POST",
  handler: handleWebhook,
});

/**
 * Analytics Routes
 * All routes use cors.route() which automatically handles OPTIONS preflight requests
 */

// Get dashboard statistics
cors.route({
  path: "/api/analytics/dashboard",
  method: "GET",
  handler: getDashboardStatsHandler,
});

/**
 * Chat Routes
 * All routes use cors.route() which automatically handles OPTIONS preflight requests
 */

// Chat with user chat agent
cors.route({
  path: "/api/chat",
  method: "POST",
  handler: chatHandler,
});

/**
 * File Routes
 * All routes use cors.route() which automatically handles OPTIONS preflight requests
 */

// Upload file
cors.route({
  path: "/api/files/upload",
  method: "POST",
  handler: uploadFileHandler,
});

// Get file URL
cors.route({
  path: "/api/files/:id/url",
  method: "GET",
  handler: getFileUrlHandler,
});

// Delete file
cors.route({
  path: "/api/files/:id",
  method: "DELETE",
  handler: deleteFileHandler,
});

export default http;

