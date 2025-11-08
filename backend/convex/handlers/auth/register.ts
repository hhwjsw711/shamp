/**
 * Email/password registration handler
 * POST /api/auth/register
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
    // Rate limiting
    const ipAddress = extractIpAddress(request.headers) || "unknown";
    checkRateLimit(`register:${ipAddress}`, {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
    });

    // Parse and validate request body
    const body = await request.json();
    const { email, password, name, orgName, location } = validate(
      registerSchema,
      body
    );

    // Check if user already exists
    const existingUser = await ctx.runQuery(
      (internal as any).functions.auth.queries.findUserByEmailInternal,
      { email }
    );

    if (existingUser) {
      return new Response(
        JSON.stringify({
          error: "User with this email already exists",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN || "*",
          },
        }
      );
    }

    // Hash password using action
    const hashedPassword = await ctx.runAction(
      api.functions.auth.authHelpers.hashPasswordAction as any,
      { password }
    );

    // Create user
    const userId = await ctx.runMutation(
      (internal as any).functions.auth.mutations.createUserInternal,
      {
        email,
        name,
        orgName,
        location,
        hashedPassword,
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
          onboardingCompleted: user.onboardingCompleted,
        },
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookieHeader,
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return new Response(
      JSON.stringify({
        error: getErrorMessage(error),
      }),
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

