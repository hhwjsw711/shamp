/**
 * Email verification handlers
 * POST /api/auth/email-verification/verify-code
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { extractIpAddress, checkRateLimit } from "../../utils/security";
import { getErrorMessage } from "../../utils/errors";
import { isCodeExpired } from "../../utils/codeGeneration";

/**
 * Verify email verification code handler
 */
export const verifyCodeHandler = httpAction(async (ctx, request) => {
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
    checkRateLimit(`verify-code:${ipAddress}`, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000, // 15 minutes
    });

    // Parse request body
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "Verification code is required" }),
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

    // Get verification code
    const verificationCode = await ctx.runQuery(
      (internal as any).functions.emailVerification.queries
        .getVerificationCodeByCodeInternal,
      { code }
    );

    if (!verificationCode) {
      return new Response(
        JSON.stringify({ error: "Invalid verification code" }),
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

    // Check if already verified
    if (verificationCode.verified) {
      return new Response(
        JSON.stringify({ error: "Code already used" }),
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
    if (isCodeExpired(verificationCode.expiresAt)) {
      return new Response(
        JSON.stringify({ error: "Verification code has expired" }),
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

    // Mark code as verified
    await ctx.runMutation(
      (internal as any).functions.emailVerification.mutations
        .markCodeAsVerifiedInternal,
      { codeId: verificationCode._id }
    );

    // Update user emailVerified status
    await ctx.runMutation(
      (internal as any).functions.auth.mutations.updateUser,
      {
        userId: verificationCode.userId,
        emailVerified: true,
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email verified successfully",
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
    console.error("Verify code error:", error);
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

