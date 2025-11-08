/**
 * PIN validation handler
 * POST /api/auth/validate-pin
 * Validates PIN and returns temporary token for ticket submission
 */

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { getErrorMessage } from "../../utils/errors";
import { extractIpAddress, extractUserAgent, checkRateLimit } from "../../utils/security";

/**
 * Validate PIN handler
 */
export const validatePinHandler = httpAction(async (ctx, request) => {
  try {
    // Get origin from request header for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    const body = await request.json();
    const { pin } = body;

    if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: "Invalid PIN format. Must be 4 digits." }),
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

    // Rate limiting
    const ipAddress = extractIpAddress(request.headers) || "unknown";
    checkRateLimit(`pin-validation:${ipAddress}`, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
    });

    // Validate PIN
    const pinOwnerId = await ctx.runAction(
      (api as any).functions.pin.actions.validatePinAction,
      { pin }
    );

    if (!pinOwnerId) {
      return new Response(
        JSON.stringify({ error: "Invalid PIN" }),
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

    // Check if PIN is enabled for this user
    const user = await ctx.runQuery(
      (internal as any).functions.auth.queries.getUserByIdInternal,
      { userId: pinOwnerId as any }
    );

    if (!user || !user.pinEnabled) {
      return new Response(
        JSON.stringify({ error: "PIN access is disabled" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    // Generate temporary token (1 hour expiry)
    const token = await ctx.runAction(
      (api as any).functions.auth.authHelpers.generatePinSessionTokenAction,
      { pinOwnerId: pinOwnerId as string }
    );

    // Create PIN session
    const userAgent = extractUserAgent(request.headers);
    await ctx.runMutation(
      (internal as any).functions.pinSessions.mutations.createPinSessionInternal,
      {
        pinOwnerId: pinOwnerId as any,
        sessionToken: token,
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        token,
        expiresIn: 3600, // 1 hour in seconds
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
    console.error("PIN validation error:", error);
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
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

