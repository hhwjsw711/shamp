/**
 * HTTP Router for Shamp backend
 * Handles all HTTP endpoints and routes them to appropriate handlers
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

// Import auth handlers
import { getGoogleAuthUrlHandler, googleCallbackHandler } from "./handlers/auth/google";
import { loginHandler } from "./handlers/auth/login";
import { registerHandler } from "./handlers/auth/register";
import { meHandler } from "./handlers/auth/me";
import { logoutHandler } from "./handlers/auth/logout";
import { completeOnboardingHandler } from "./handlers/auth/onboarding";

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
} from "./handlers/tickets/index";

// Import vendor handlers
import {
  createVendorHandler,
  getVendorByIdHandler,
  listVendorsHandler,
  updateVendorHandler,
} from "./handlers/vendors/index";

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
 * CORS preflight handler for all routes
 */
http.route({
  path: "/:path*",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN || "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
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
http.route({
  path: "/api/auth/google/callback",
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

/**
 * Ticket Routes
 */

// Create ticket
http.route({
  path: "/api/tickets",
  method: "POST",
  handler: createTicketHandler,
});

// List tickets
http.route({
  path: "/api/tickets",
  method: "GET",
  handler: listTicketsHandler,
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

// Assign vendor to ticket
http.route({
  path: "/api/tickets/:id/assign-vendor",
  method: "POST",
  handler: assignVendorHandler,
});

// Close ticket
http.route({
  path: "/api/tickets/:id/close",
  method: "POST",
  handler: closeTicketHandler,
});

// Schedule repair
http.route({
  path: "/api/tickets/:id/schedule",
  method: "POST",
  handler: scheduleRepairHandler,
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

export default http;

