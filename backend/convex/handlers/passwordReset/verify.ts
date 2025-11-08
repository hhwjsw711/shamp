/**
 * Password reset verify handler
 * POST /api/auth/password-reset/verify
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { validate, passwordResetVerifySchema } from "../../utils/validation";
import { extractIpAddress, checkRateLimit } from "../../utils/security";
import { getErrorMessage } from "../../utils/errors";
import { isCodeExpired } from "../../utils/codeGeneration";

/**
 * Verify password reset code handler
 */
export const verifyPasswordResetCodeHandler = httpAction(async (ctx, request) => {
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
    checkRateLimit(`password-reset-verify:${ipAddress}`, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000, // 15 minutes
    });

    // Parse and validate request body
    const body = await request.json();
    const { code } = validate(passwordResetVerifySchema, body);

    // Get reset code
    const resetCode = await ctx.runQuery(
      (internal as any).functions.passwordReset.queries.getResetCodeByCodeInternal,
      { code }
    );

    if (!resetCode) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired reset code" }),
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

    // Check if already used
    if (resetCode.used) {
      return new Response(
        JSON.stringify({ error: "This reset code has already been used" }),
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

    // Check if expired
    if (isCodeExpired(resetCode.expiresAt)) {
      return new Response(
        JSON.stringify({ error: "Reset code has expired. Please request a new one." }),
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

    // Return success - code is valid
    return new Response(
      JSON.stringify({
        success: true,
        message: "Reset code verified successfully",
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
    console.error("Verify password reset code error:", error);
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

