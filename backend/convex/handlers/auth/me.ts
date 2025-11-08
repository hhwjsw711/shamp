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
    const sessionToken = await ctx.runAction(
      api.functions.auth.authHelpers.extractSessionTokenAction as any,
      { cookieHeader }
    );

    if (!sessionToken) {
      return new Response(
        JSON.stringify({
          error: "Not authenticated",
        }),
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
            "Access-Control-Allow-Origin": "*",
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
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Get frontend URL for CORS
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    );

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
          "Access-Control-Allow-Origin": frontendUrl || "http://localhost:3000",
        },
      }
    );
  } catch (error) {
    console.error("Get current user error:", error);
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    );
    return new Response(
      JSON.stringify({
        error: getErrorMessage(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": frontendUrl || "http://localhost:3000",
        },
      }
    );
  }
});

