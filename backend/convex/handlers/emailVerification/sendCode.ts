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
import { validate, emailVerificationCodeSchema } from "../../utils/validation";

/**
 * Send email verification code handler
 */
export const sendCodeHandler = httpAction(async (ctx, request) => {
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
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Credentials": "true",
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
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Credentials": "true",
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
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Credentials": "true",
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
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Credentials": "true",
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
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error) {
    console.error("Send verification code error:", error);
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

    // Parse and validate request body
    const body = await request.json();
    const { code } = validate(emailVerificationCodeSchema, body);

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
