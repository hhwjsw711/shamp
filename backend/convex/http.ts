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

export default http;

