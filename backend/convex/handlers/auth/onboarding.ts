/**
 * Onboarding handler - Complete user profile after email verification
 * POST /api/auth/onboarding
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { validate, updateProfileSchema } from "../../utils/validation";
import { getErrorMessage } from "../../utils/errors";
import { formatName } from "../../utils/nameUtils";

/**
 * Complete onboarding handler
 */
export const completeOnboardingHandler = httpAction(async (ctx, request) => {
  try {
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

    // Check if email is verified (required for email/password users)
    if (!user.googleId && !user.emailVerified) {
      return new Response(
        JSON.stringify({ error: "Please verify your email before completing onboarding" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { name, orgName, location } = validate(updateProfileSchema, body);

    // Format name if provided
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
    console.error("Onboarding error:", error);
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

