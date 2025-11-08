/**
 * Logout handler
 * POST /api/auth/logout
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { getErrorMessage } from "../../utils/errors";

/**
 * Logout handler - clears session cookie and deletes session from database
 */
export const logoutHandler = httpAction(async (ctx, request) => {
  try {
    // Get origin from request header for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    // Extract session token from cookie using action
    const cookieHeader = request.headers.get("cookie");
    const sessionToken = await ctx.runAction(
      api.functions.auth.authHelpers.extractSessionTokenAction as any,
      { cookieHeader }
    );

    if (sessionToken) {
      // Delete session from database
      await ctx.runMutation(
        (internal as any).functions.sessions.mutations.deleteSession,
        {
          sessionToken,
        }
      );
    }

    // Create delete cookie using action
    const deleteCookieHeader = await ctx.runAction(
      api.functions.auth.authHelpers.createDeleteCookieAction as any,
      {}
    );

    // Return success response with cookie deletion
    return new Response(
      JSON.stringify({
        success: true,
        message: "Logged out successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": deleteCookieHeader,
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error) {
    console.error("Logout error:", error);
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;
    
    // Even if there's an error, clear the cookie
    const deleteCookieHeader = await ctx.runAction(
      api.functions.auth.authHelpers.createDeleteCookieAction as any,
      {}
    );
    return new Response(
      JSON.stringify({
        success: true,
        message: "Logged out",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": deleteCookieHeader,
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  }
});

