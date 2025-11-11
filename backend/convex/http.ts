/**
 * HTTP Router for Shamp backend
 * Handles all HTTP endpoints and routes them to appropriate handlers
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

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
 * Health check endpoint
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
 * CORS preflight handler helper function
 */
const corsPreflightHandler = httpAction(async (ctx, request) => {
  // Get origin from request header for CORS
  const origin = request.headers.get("origin");
  const frontendUrl = await ctx.runAction(
    (api as any).functions.auth.getEnv.getEnvVar,
    { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
  ) || "http://localhost:3000";
  
  // Use origin from request if available, otherwise fallback to FRONTEND_URL
  const allowedOrigin = origin || frontendUrl;
  
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
});

/**
 * CORS preflight handlers for specific routes
 * Convex requires explicit OPTIONS handlers for each route
 */
http.route({
  path: "/api/auth/google/url",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/api/auth/callback/google",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/api/auth/login",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/api/auth/register",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/api/auth/me",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/api/auth/logout",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/api/auth/email-verification/send-code",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/api/auth/email-verification/verify-code",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/api/auth/password-reset/request",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/api/auth/password-reset/verify",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/api/auth/password-reset/complete",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/api/auth/onboarding",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/api/auth/validate-pin",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

/**
 * Authentication Routes
 */

// Get Google OAuth URL
http.route({
  path: "/api/auth/google/url",
  method: "GET",
  handler: getGoogleAuthUrlHandler,
});

// Google OAuth callback
// Note: Google OAuth redirects to /api/auth/callback/google (not /api/auth/google/callback)
http.route({
  path: "/api/auth/callback/google",
  method: "GET",
  handler: googleCallbackHandler,
});

// Email/password login
http.route({
  path: "/api/auth/login",
  method: "POST",
  handler: loginHandler,
});

// Email/password registration
http.route({
  path: "/api/auth/register",
  method: "POST",
  handler: registerHandler,
});

// Get current user
http.route({
  path: "/api/auth/me",
  method: "GET",
  handler: meHandler,
});

// Logout
http.route({
  path: "/api/auth/logout",
  method: "POST",
  handler: logoutHandler,
});

// Email verification routes
http.route({
  path: "/api/auth/email-verification/send-code",
  method: "POST",
  handler: sendCodeHandler,
});

http.route({
  path: "/api/auth/email-verification/verify-code",
  method: "POST",
  handler: verifyCodeHandler,
});

// Password reset routes
http.route({
  path: "/api/auth/password-reset/request",
  method: "POST",
  handler: requestPasswordResetHandler,
});

http.route({
  path: "/api/auth/password-reset/verify",
  method: "POST",
  handler: verifyPasswordResetCodeHandler,
});

http.route({
  path: "/api/auth/password-reset/complete",
  method: "POST",
  handler: completePasswordResetHandler,
});

// Onboarding route
http.route({
  path: "/api/auth/onboarding",
  method: "POST",
  handler: completeOnboardingHandler,
});

// PIN validation route
http.route({
  path: "/api/auth/validate-pin",
  method: "POST",
  handler: validatePinHandler,
});

/**
 * Ticket Routes
 */

// Create ticket
http.route({
  path: "/api/tickets",
  method: "POST",
  handler: createTicketHandler,
});

http.route({
  path: "/api/tickets",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// List tickets
http.route({
  path: "/api/tickets",
  method: "GET",
  handler: listTicketsHandler,
});

// OPTIONS handler for /api/tickets/:id (must be before GET/PATCH/DELETE)
http.route({
  path: "/api/tickets/:id",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// Get ticket by ID
http.route({
  path: "/api/tickets/:id",
  method: "GET",
  handler: getTicketByIdHandler,
});

// Update ticket
http.route({
  path: "/api/tickets/:id",
  method: "PATCH",
  handler: updateTicketHandler,
});

// Update ticket status
http.route({
  path: "/api/tickets/:id/status",
  method: "PATCH",
  handler: updateTicketStatusHandler,
});

http.route({
  path: "/api/tickets/:id/status",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// Assign vendor to ticket
http.route({
  path: "/api/tickets/:id/assign-vendor",
  method: "POST",
  handler: assignVendorHandler,
});

http.route({
  path: "/api/tickets/:id/assign-vendor",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// Close ticket
http.route({
  path: "/api/tickets/:id/close",
  method: "POST",
  handler: closeTicketHandler,
});

http.route({
  path: "/api/tickets/:id/close",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// Schedule repair
http.route({
  path: "/api/tickets/:id/schedule",
  method: "POST",
  handler: scheduleRepairHandler,
});

http.route({
  path: "/api/tickets/:id/schedule",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// Delete ticket
http.route({
  path: "/api/tickets/:id",
  method: "DELETE",
  handler: deleteTicketHandler,
});

// Delete photo from ticket
http.route({
  path: "/api/tickets/:id/photos/:photoId",
  method: "DELETE",
  handler: deletePhotoFromTicketHandler,
});

http.route({
  path: "/api/tickets/:id/photos/:photoId",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// Submit ticket with PIN (for staff/guests)
http.route({
  path: "/api/tickets/submit-with-pin",
  method: "POST",
  handler: submitTicketWithPinHandler,
});

http.route({
  path: "/api/tickets/submit-with-pin",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// Update vendor status
http.route({
  path: "/api/tickets/:id/vendor-status",
  method: "PATCH",
  handler: updateVendorStatusHandler,
});

http.route({
  path: "/api/tickets/:id/vendor-status",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// Upload after photos
http.route({
  path: "/api/tickets/:id/after-photos",
  method: "POST",
  handler: uploadAfterPhotosHandler,
});

http.route({
  path: "/api/tickets/:id/after-photos",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// Update guest impact
http.route({
  path: "/api/tickets/:id/guest-impact",
  method: "PATCH",
  handler: updateGuestImpactHandler,
});

http.route({
  path: "/api/tickets/:id/guest-impact",
  method: "OPTIONS",
  handler: corsPreflightHandler,
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
 */

// List vendor quotes
http.route({
  path: "/api/vendor-quotes",
  method: "GET",
  handler: listVendorQuotesHandler,
});

http.route({
  path: "/api/vendor-quotes",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// Get vendor quote by ID
http.route({
  path: "/api/vendor-quotes/:id",
  method: "GET",
  handler: getVendorQuoteByIdHandler,
});

http.route({
  path: "/api/vendor-quotes/:id",
  method: "OPTIONS",
  handler: corsPreflightHandler,
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

// Discover vendors
http.route({
  path: "/api/agents/discover-vendors",
  method: "POST",
  handler: discoverVendorsHandler,
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
 */

// Get dashboard statistics
http.route({
  path: "/api/analytics/dashboard",
  method: "GET",
  handler: getDashboardStatsHandler,
});

http.route({
  path: "/api/analytics/dashboard",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

/**
 * Chat Routes
 */

// Chat with user chat agent
http.route({
  path: "/api/chat",
  method: "POST",
  handler: chatHandler,
});

http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

/**
 * File Routes
 */

// Upload file
http.route({
  path: "/api/files/upload",
  method: "POST",
  handler: uploadFileHandler,
});

http.route({
  path: "/api/files/upload",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// Get file URL
http.route({
  path: "/api/files/:id/url",
  method: "GET",
  handler: getFileUrlHandler,
});

http.route({
  path: "/api/files/:id/url",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// Delete file
http.route({
  path: "/api/files/:id",
  method: "DELETE",
  handler: deleteFileHandler,
});

http.route({
  path: "/api/files/:id",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

export default http;

