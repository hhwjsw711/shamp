/**
 * Email/password registration handler
 * POST /api/auth/register
 * Only requires email and password - user completes onboarding after email verification
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { validate, registerSchema } from "../../utils/validation";
import { extractIpAddress, extractUserAgent, checkRateLimit } from "../../utils/security";
import { getErrorMessage } from "../../utils/errors";

/**
 * Email/password registration handler
 */
export const registerHandler = httpAction(async (ctx, request) => {
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
    checkRateLimit(`register:${ipAddress}`, {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
    });

    // Parse and validate request body (only email and password)
    const body = await request.json();
    const { email, password } = validate(registerSchema, body);

    // Check if user already exists
    const existingUser = await ctx.runQuery(
      (internal as any).functions.auth.queries.findUserByEmailInternal,
      { email }
    );

    if (existingUser) {
      return new Response(
        JSON.stringify({
          error: "An account with this email already exists. Please sign in instead.",
        }),
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

    // Hash password using action
    const hashedPassword = await ctx.runAction(
      (api as any).functions.auth.authHelpers.hashPasswordAction,
      { password }
    );

    // Create user (emailVerified defaults to false, will be set after verification)
    const userId = await ctx.runMutation(
      (internal as any).functions.auth.mutations.createUserInternal,
      {
        email,
        hashedPassword,
        emailVerified: false,
      }
    );

    // Get created user
    const user = await ctx.runQuery(
      (internal as any).functions.auth.queries.getUserByIdInternal,
      { userId }
    );

    if (!user) {
      throw new Error("Failed to create user");
    }

    // Send email verification code
    await ctx.runAction(
      (api as any).functions.emailVerification.actions.sendVerificationCode,
      {
        userId: user._id,
        email: user.email,
      }
    );

    // Generate JWT token using action (user can stay logged in but needs to verify email)
    const token = await ctx.runAction(
      (api as any).functions.auth.authHelpers.generateTokenAction,
      {
        userId: user._id,
        email: user.email,
        provider: "email",
      }
    );

    // Create secure cookie using action
    const cookieHeader = await ctx.runAction(
      (api as any).functions.auth.authHelpers.createSecureCookieAction,
      { token }
    );

    // Create session in database
    const userAgent = extractUserAgent(request.headers);
    await ctx.runMutation(
      (internal as any).functions.sessions.mutations.createSession,
      {
        userId: user._id,
        sessionToken: token,
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
      }
    );

    // Return success response with cookie
    return new Response(
      JSON.stringify({
        success: true,
        message: "Account created successfully. Please check your email to verify your account.",
        user: {
          id: user._id,
          email: user.email,
          emailVerified: user.emailVerified,
          onboardingCompleted: user.onboardingCompleted,
        },
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookieHeader,
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error) {
    console.error("Registration error:", error);
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;
    
    return new Response(
      JSON.stringify({
        error: getErrorMessage(error),
      }),
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

