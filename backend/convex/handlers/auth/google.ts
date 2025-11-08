/**
 * Google OAuth handler - HTTP action for Google OAuth flow
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { extractIpAddress, extractUserAgent } from "../../utils/security";
import { getErrorMessage } from "../../utils/errors";

/**
 * Get Google OAuth URL endpoint
 * GET /api/auth/google/url
 */
export const getGoogleAuthUrlHandler = httpAction(async (_ctx, request) => {
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state") || "";

    // Get Google OAuth URL using action
    const result = await _ctx.runAction(
      api.functions.auth.actions.getGoogleAuthUrlAction as any,
      { state }
    );

    return new Response(
      JSON.stringify({ url: result.url }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error generating Google OAuth URL:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate OAuth URL",
        message: getErrorMessage(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

/**
 * Google OAuth callback handler
 * GET /api/auth/google/callback
 */
export const googleCallbackHandler = httpAction(async (ctx, request) => {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") || "";

    if (!code) {
      // Get frontend URL from environment variable using action
      const frontendUrl = await ctx.runAction(
        api.functions.auth.getEnv.getEnvVar as any,
        { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
      ) || await ctx.runAction(
        api.functions.auth.getEnv.getEnvVar as any,
        { key: "CLIENT_ORIGIN", defaultValue: "http://localhost:3000" }
      ) || "http://localhost:3000";
      
      const errorUrl = new URL("/login", frontendUrl);
      errorUrl.searchParams.set("error", "Missing authorization code");
      return new Response(null, {
        status: 302,
        headers: {
          Location: errorUrl.toString(),
        },
      });
    }

    // Exchange code for user info using action
    const googleUser = await ctx.runAction(
      api.functions.auth.actions.getGoogleUserAction as any,
      { code }
    );

    if (!googleUser.email || !googleUser.googleId) {
      // Get frontend URL from environment variable using action
      const frontendUrl = await ctx.runAction(
        api.functions.auth.getEnv.getEnvVar as any,
        { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
      ) || await ctx.runAction(
        api.functions.auth.getEnv.getEnvVar as any,
        { key: "CLIENT_ORIGIN", defaultValue: "http://localhost:3000" }
      ) || "http://localhost:3000";
      
      const errorUrl = new URL("/login", frontendUrl);
      errorUrl.searchParams.set("error", "Failed to get user info from Google");
      return new Response(null, {
        status: 302,
        headers: {
          Location: errorUrl.toString(),
        },
      });
    }

    // Find or create user
    let user = await ctx.runQuery(
      (internal as any).functions.auth.queries.findUserByEmailInternal,
      { email: googleUser.email }
    );

    if (!user) {
      // Create new user account with Google info
      const userId = await ctx.runMutation(
        (internal as any).functions.auth.mutations.createUserInternal,
        {
          email: googleUser.email,
          name: googleUser.name || googleUser.email.split("@")[0],
          googleId: googleUser.googleId,
          profilePic: googleUser.picture,
        }
      );
      user = await ctx.runQuery(
        (internal as any).functions.auth.queries.getUserByIdInternal,
        { userId }
      );
    } else if (!user.googleId && googleUser.googleId) {
      // Link Google account to existing user
      await ctx.runMutation(
        (internal as any).functions.auth.mutations.linkGoogleAccountInternal,
        {
          userId: user._id,
          googleId: googleUser.googleId,
          name: googleUser.name,
          profilePic: googleUser.picture,
        }
      );
      user = await ctx.runQuery(
        (internal as any).functions.auth.queries.getUserByIdInternal,
        { userId: user._id }
      );
    }

    if (!user) {
      // Get frontend URL from environment variable using action
      const frontendUrl = await ctx.runAction(
        api.functions.auth.getEnv.getEnvVar as any,
        { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
      ) || await ctx.runAction(
        api.functions.auth.getEnv.getEnvVar as any,
        { key: "CLIENT_ORIGIN", defaultValue: "http://localhost:3000" }
      ) || "http://localhost:3000";
      
      const errorUrl = new URL("/login", frontendUrl);
      errorUrl.searchParams.set("error", "Failed to create user");
      return new Response(null, {
        status: 302,
        headers: {
          Location: errorUrl.toString(),
        },
      });
    }

    // Generate JWT token using action
    const token = await ctx.runAction(
      api.functions.auth.authHelpers.generateTokenAction as any,
      {
        userId: user._id,
        email: user.email,
        name: user.name,
        provider: "google",
      }
    );

    // Create secure cookie using action
    const cookieHeader = await ctx.runAction(
      api.functions.auth.authHelpers.createSecureCookieAction as any,
      { token }
    );

    // Create session in database
    const ipAddress = extractIpAddress(request.headers);
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

    // Redirect to frontend with cookie set
    // Get frontend URL from environment variable using action
    const frontendUrl = await ctx.runAction(
      api.functions.auth.getEnv.getEnvVar as any,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || await ctx.runAction(
      api.functions.auth.getEnv.getEnvVar as any,
      { key: "CLIENT_ORIGIN", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const redirectUrl = new URL("/auth/callback", frontendUrl);
    if (!user.onboardingCompleted) {
      redirectUrl.searchParams.set("onboarding", "true");
    }
    if (state) {
      redirectUrl.searchParams.set("state", state);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl.toString(),
        "Set-Cookie": cookieHeader,
      },
    });
  } catch (error: any) {
    console.error("Google OAuth callback error:", error);
    // Get frontend URL from environment variable using action
    const frontendUrl = await ctx.runAction(
      api.functions.auth.getEnv.getEnvVar as any,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || await ctx.runAction(
      api.functions.auth.getEnv.getEnvVar as any,
      { key: "CLIENT_ORIGIN", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const errorUrl = new URL("/login", frontendUrl);
    errorUrl.searchParams.set("error", getErrorMessage(error));
    return new Response(null, {
      status: 302,
      headers: {
        Location: errorUrl.toString(),
      },
    });
  }
});

