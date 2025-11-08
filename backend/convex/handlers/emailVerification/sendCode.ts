/**
 * Email verification handlers
 * POST /api/auth/email-verification/send-code
 * POST /api/auth/email-verification/verify-code
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { extractIpAddress, checkRateLimit } from "../../utils/security";
import { getErrorMessage } from "../../utils/errors";
import { isCodeExpired } from "../../utils/codeGeneration";

/**
 * Send email verification code handler
 */
export const sendCodeHandler = httpAction(async (ctx, request) => {
  try {
    // Rate limiting
    const ipAddress = extractIpAddress(request.headers) || "unknown";
    checkRateLimit(`email-verification:${ipAddress}`, {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
    });

    // Extract session token from cookie using action
    const cookieHeader = request.headers.get("cookie");
    const sessionToken = await ctx.runAction(
      (api as any).functions.auth.authHelpers.extractSessionTokenAction,
      { cookieHeader }
    );

    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Verify token using action
    const payload = await ctx.runAction(
      (api as any).functions.auth.authHelpers.verifyTokenAction,
      { token: sessionToken }
    );

    if (!payload || !payload.userId) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Get user
    const user = await ctx.runQuery(
      (internal as any).functions.auth.queries.getUserByIdInternal,
      { userId: payload.userId as any }
    );

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (user.emailVerified) {
      return new Response(
        JSON.stringify({ error: "Email already verified" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Send verification code
    await ctx.runAction(
      (api as any).functions.emailVerification.actions.sendVerificationCode,
      {
        userId: user._id,
        email: user.email,
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification code sent to your email",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Send verification code error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

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
          "Access-Control-Allow-Origin": "*",
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
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
