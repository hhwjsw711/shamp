/**
 * Session validation and current user handler
 * GET /api/auth/me
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { getErrorMessage } from "../../utils/errors";

/**
 * Get current user from session
 */
export const meHandler = httpAction(async (ctx, request) => {
  try {
    // Extract session token from cookie using action
    const cookieHeader = request.headers.get("cookie");
    
    // Also check Authorization header as fallback for localhost
    const authHeader = request.headers.get("authorization");
    let sessionToken: string | null = null;
    
    // Try cookie first
    if (cookieHeader) {
      sessionToken = await ctx.runAction(
        api.functions.auth.authHelpers.extractSessionTokenAction as any,
        { cookieHeader }
      );
    }
    
    // Fallback to Authorization header if no cookie (for localhost development)
    if (!sessionToken && authHeader?.startsWith("Bearer ")) {
      sessionToken = authHeader.substring(7);
    }
    
    // Debug logging
    if (process.env.NODE_ENV !== "production") {
      console.log("[/api/auth/me] Cookie header:", cookieHeader ? "Present" : "Missing");
      console.log("[/api/auth/me] Auth header:", authHeader ? "Present" : "Missing");
      console.log("[/api/auth/me] Session token:", sessionToken ? "Found" : "Missing");
    }

    // Get origin from request header for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    if (!sessionToken) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[/api/auth/me] No session token found. Cookie header:", cookieHeader);
      }
      return new Response(
        JSON.stringify({
          error: "Not authenticated",
        }),
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
      api.functions.auth.authHelpers.verifyTokenAction as any,
      { token: sessionToken }
    );
    if (!payload || !payload.userId) {
      return new Response(
        JSON.stringify({
          error: "Invalid session",
        }),
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

    // Get full user document
    const fullUser = await ctx.runQuery(
      (internal as any).functions.auth.queries.getUserByIdInternal,
      { userId: payload.userId as any }
    );

    if (!fullUser) {
      return new Response(
        JSON.stringify({
          error: "User not found",
        }),
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

    // Return user info (exclude sensitive fields)
    return new Response(
      JSON.stringify({
        user: {
          id: fullUser._id,
          email: fullUser.email,
          name: fullUser.name,
          orgName: fullUser.orgName,
          location: fullUser.location,
          profilePic: fullUser.profilePic,
          emailVerified: fullUser.emailVerified,
          onboardingCompleted: fullUser.onboardingCompleted,
        },
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
    console.error("Get current user error:", error);
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
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  }
});

