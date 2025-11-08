/**
 * Email/password login handler
 * POST /api/auth/login
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { validate, loginSchema } from "../../utils/validation";
import { extractIpAddress, extractUserAgent, checkRateLimit } from "../../utils/security";
import { AuthenticationError, getErrorMessage } from "../../utils/errors";

/**
 * Email/password login handler
 */
export const loginHandler = httpAction(async (ctx, request) => {
  try {
    // Rate limiting
    const ipAddress = extractIpAddress(request.headers) || "unknown";
    checkRateLimit(`login:${ipAddress}`, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
    });

    // Parse and validate request body
    const body = await request.json();
    const { email, password } = validate(loginSchema, body);

    // Find user by email
    const user = await ctx.runQuery(
      (internal as any).functions.auth.queries.findUserByEmailInternal,
      { email }
    );

    if (!user || !user.hashedPassword) {
      throw new AuthenticationError("Invalid email or password");
    }

    // Verify password using action
    const isValid = await ctx.runAction(
      api.functions.auth.authHelpers.comparePasswordAction as any,
      {
        password,
        hash: user.hashedPassword,
      }
    );

    if (!isValid) {
      throw new AuthenticationError("Invalid email or password");
    }

    // Generate JWT token using action
    const token = await ctx.runAction(
      api.functions.auth.authHelpers.generateTokenAction as any,
      {
        userId: user._id,
        email: user.email,
        name: user.name,
        provider: "email",
      }
    );

    // Create secure cookie using action
    const cookieHeader = await ctx.runAction(
      api.functions.auth.authHelpers.createSecureCookieAction as any,
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

    // Update last login
    await ctx.runMutation(
      (internal as any).functions.auth.mutations.updateLastLogin,
      {
        userId: user._id,
      }
    );

    // Return success response with cookie
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          orgName: user.orgName,
          location: user.location,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookieHeader,
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Login error:", error);
    const statusCode = error instanceof AuthenticationError ? 401 : 400;
    return new Response(
      JSON.stringify({
        error: getErrorMessage(error),
      }),
      {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

