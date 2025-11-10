/**
 * Password reset complete handler
 * POST /api/auth/password-reset/complete
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { validate, passwordResetCompleteSchema } from "../../utils/validation";
import { extractIpAddress, checkRateLimit } from "../../utils/security";
import { getErrorMessage } from "../../utils/errors";

/**
 * Complete password reset handler
 */
export const completePasswordResetHandler = httpAction(async (ctx, request) => {
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
    checkRateLimit(`password-reset-complete:${ipAddress}`, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
    });

    // Parse and validate request body
    const body = await request.json();
    const { userId, newPassword } = validate(passwordResetCompleteSchema, body);

    // Verify user exists
    const user = await ctx.runQuery(
      (internal as any).functions.auth.queries.getUserByIdInternal,
      { userId }
    );

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid user" }),
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

    // Hash new password using action
    const hashedPassword = await ctx.runAction(
      (api as any).functions.auth.authHelpers.hashPasswordAction,
      { password: newPassword }
    );

    // Update user password
    await ctx.runMutation(
      (internal as any).functions.auth.mutations.updatePasswordInternal,
      {
        userId: userId,
        hashedPassword,
      }
    );

    // Delete all sessions for this user (force re-login with new password)
    await ctx.runMutation(
      (internal as any).functions.sessions.mutations.deleteSessionsByUserId,
      { userId: userId }
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password reset successfully. Please sign in with your new password.",
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
    console.error("Complete password reset error:", error);
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

