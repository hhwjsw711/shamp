/**
 * Password reset request handler
 * POST /api/auth/password-reset/request
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { validate, passwordResetRequestSchema } from "../../utils/validation";
import { extractIpAddress, checkRateLimit } from "../../utils/security";
import { getErrorMessage } from "../../utils/errors";

/**
 * Request password reset code handler
 */
export const requestPasswordResetHandler = httpAction(async (ctx, request) => {
  try {
    // Get origin from request header for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    // Rate limiting
    const ipAddress = extractIpAddress(request.headers) || "unknown";
    checkRateLimit(`password-reset-request:${ipAddress}`, {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
    });

    // Parse and validate request body
    const body = await request.json();
    const { email } = validate(passwordResetRequestSchema, body);

    // Find user by email
    const user = await ctx.runQuery(
      (internal as any).functions.auth.queries.findUserByEmailInternal,
      { email }
    );

    // Don't reveal if user exists or not (security best practice)
    // Always return success message
    if (user) {
      // Send password reset code
      await ctx.runAction(
        (api as any).functions.passwordReset.actions.sendPasswordResetCode,
        {
          userId: user._id,
          email: user.email,
        }
      );
    }

    // Return success response (don't reveal if user exists)
    return new Response(
      JSON.stringify({
        success: true,
        message: "If an account with this email exists, a password reset code has been sent.",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error) {
    console.error("Password reset request error:", error);
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  }
});

