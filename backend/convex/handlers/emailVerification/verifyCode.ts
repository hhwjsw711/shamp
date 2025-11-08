/**
 * Email verification handlers
 * POST /api/auth/email-verification/verify-code
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { extractIpAddress, checkRateLimit } from "../../utils/security";
import { getErrorMessage } from "../../utils/errors";
import { isCodeExpired } from "../../utils/codeGeneration";

/**
 * Verify email verification code handler
 */
export const verifyCodeHandler = httpAction(async (ctx, request) => {
  try {
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
            "Access-Control-Allow-Origin": "*",
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
            "Access-Control-Allow-Origin": "*",
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
            "Access-Control-Allow-Origin": "*",
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
            "Access-Control-Allow-Origin": "*",
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
          "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN || "*",
        },
      }
    );
  } catch (error) {
    console.error("Verify code error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN || "*",
        },
      }
    );
  }
});

