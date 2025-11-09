/**
 * Onboarding handler - Complete user profile after email verification
 * POST /api/auth/onboarding
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { validate, updateProfileSchema } from "../../utils/validation";
import { getErrorMessage } from "../../utils/errors";
import { formatName, sanitizeName } from "../../utils/nameUtils";

/**
 * Complete onboarding handler
 */
export const completeOnboardingHandler = httpAction(async (ctx, request) => {
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

    // Check if email is verified (required for email/password users)
    if (!user.googleId && !user.emailVerified) {
      return new Response(
        JSON.stringify({ error: "Please verify your email before completing onboarding" }),
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

    // Parse request body
    const body = await request.json();
    
    // CRITICAL: Sanitize name BEFORE validation to remove quotes, brackets, etc.
    // This MUST happen before validation or validation will fail
    if (body.name && typeof body.name === 'string') {
      // Trim first
      body.name = body.name.trim();
      
      // Sanitize to remove all invalid characters (quotes, brackets, etc.)
      body.name = sanitizeName(body.name);
      
      // If sanitized name is valid, format it (capitalize)
      // formatName will sanitize again (redundant but safe) and capitalize
      if (body.name && body.name.length > 0) {
        const formatted = formatName(body.name);
        body.name = formatted || body.name;
      } else {
        body.name = '';
      }
    }
    
    // Validate request body (after sanitization - name should now be clean)
    // The validate function will check against the schema which requires /^[a-zA-Z\s'-]+$/
    const { name, orgName, location } = validate(updateProfileSchema, body);

    // Format name if provided (formatName already sanitizes, but ensure it's formatted)
    const formattedName = name ? formatName(name) : user.name;

    // Update user profile
    await ctx.runMutation(
      (internal as any).functions.auth.mutations.updateUser,
      {
        userId: user._id,
        name: formattedName,
        orgName,
        location,
        onboardingCompleted: true,
      }
    );

    // Generate PIN for user (optional, but recommended)
    // PIN allows staff/guests to submit tickets without creating accounts
    let pin: string | undefined;
    try {
      pin = await ctx.runAction(
        (api as any).functions.pin.actions.generatePinAction,
        { userId: user._id }
      );
    } catch (error) {
      console.error("Failed to generate PIN during onboarding:", error);
      // Continue without PIN - user can generate it later
    }

    // Get updated user
    const updatedUser = await ctx.runQuery(
      (internal as any).functions.auth.queries.getUserByIdInternal,
      { userId: user._id }
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Onboarding completed successfully",
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          name: updatedUser.name,
          orgName: updatedUser.orgName,
          location: updatedUser.location,
          onboardingCompleted: updatedUser.onboardingCompleted,
        },
        pin: pin, // Return PIN so user can see it once (frontend should show this)
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
    console.error("Onboarding error:", error);
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

