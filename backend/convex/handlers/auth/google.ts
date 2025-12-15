/**
 * Google OAuth handler - HTTP action for Google OAuth flow
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { extractIpAddress, extractUserAgent } from "../../utils/security";
import { getErrorMessage } from "../../utils/errors";
import { formatName } from "../../utils/nameUtils";

/**
 * Get Google OAuth URL endpoint
 * GET /api/auth/google/url
 */
export const getGoogleAuthUrlHandler = httpAction(async (_ctx, request) => {
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state") || "";

    // When running behind the app's /api proxy, origin might be stripped.
    // Prefer x-forwarded-origin so Google redirect_uri matches the app origin.
    const forwardedOrigin = request.headers.get("x-forwarded-origin");
    const origin = request.headers.get("origin");
    const frontendUrl = await _ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const appOrigin = forwardedOrigin || origin || frontendUrl;
    const allowedOrigin = origin || frontendUrl;
    const redirectUri = new URL("/api/auth/callback/google", appOrigin).toString();

    // Get Google OAuth URL using action
    const result = await _ctx.runAction(
      api.functions.auth.actions.getGoogleAuthUrlAction as any,
      { state, redirectUri }
    );

    return new Response(
      JSON.stringify({ url: result.url }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error) {
    console.error("Error generating Google OAuth URL:", error);
    const origin = request.headers.get("origin");
    const frontendUrl = await _ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;
    
    return new Response(
      JSON.stringify({
        error: "Failed to generate OAuth URL",
        message: getErrorMessage(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
});

/**
 * Google OAuth callback handler
 * GET /api/auth/callback/google
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
      ) || "http://localhost:3000";
      
      const errorUrl = new URL("/auth/login", frontendUrl);
      errorUrl.searchParams.set("error", "Missing authorization code");
      return new Response(null, {
        status: 302,
        headers: {
          Location: errorUrl.toString(),
        },
      });
    }

    const forwardedOrigin = request.headers.get("x-forwarded-origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    const appOrigin = forwardedOrigin || frontendUrl;
    const redirectUri = new URL("/api/auth/callback/google", appOrigin).toString();

    // Exchange code for user info using action
    const googleUser = await ctx.runAction(
      api.functions.auth.actions.getGoogleUserAction as any,
      { code, redirectUri }
    );

    if (!googleUser.email || !googleUser.googleId) {
      // Get frontend URL from environment variable using action
      const frontendUrl = await ctx.runAction(
        api.functions.auth.getEnv.getEnvVar as any,
        { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
      ) || "http://localhost:3000";
      
      const errorUrl = new URL("/auth/login", frontendUrl);
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

    const isNewUser = !user;
    // Format name from Google (sanitizes quotes, brackets, etc.)
    // formatName returns null if name is empty/invalid, which is fine for optional field
    const formattedName = formatName(googleUser.name);

    if (!user) {
      // Create new user account with Google info (emailVerified is true for Google accounts)
      const userId = await ctx.runMutation(
        (internal as any).functions.auth.mutations.createUserInternal,
        {
          email: googleUser.email,
          name: formattedName, // Can be null, which is fine
          googleId: googleUser.googleId,
          profilePic: googleUser.picture,
          emailVerified: true, // Google accounts are pre-verified
        }
      );
      user = await ctx.runQuery(
        (internal as any).functions.auth.queries.getUserByIdInternal,
        { userId }
      );
    } else if (!user.googleId && googleUser.googleId) {
      // Link Google account to existing user
      // Only update name if formattedName is not null and user doesn't have a name
      await ctx.runMutation(
        (internal as any).functions.auth.mutations.linkGoogleAccountInternal,
        {
          userId: user._id,
          googleId: googleUser.googleId,
          name: formattedName || user.name, // Use formatted name if available, otherwise keep existing
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
      ) || "http://localhost:3000";
      
      const errorUrl = new URL("/auth/login", frontendUrl);
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
      (api as any).functions.auth.authHelpers.generateTokenAction,
      {
        userId: user._id,
        email: user.email,
        name: user.name,
        provider: "google",
      }
    );

    // Create secure cookie using action
    const cookieHeader = await ctx.runAction(
      (api as any).functions.auth.authHelpers.createSecureCookieAction,
      { token, frontendUrl }
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

    // For new users or users who haven't completed onboarding, redirect to onboarding
    // For existing users who have completed onboarding, redirect to dashboard/home
    const redirectPath = isNewUser || !user.onboardingCompleted 
      ? "/auth/onboarding" 
      : "/";
    
    const redirectUrl = new URL(redirectPath, frontendUrl);
    
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
    ) || "http://localhost:3000";
    
    const errorUrl = new URL("/auth/login", frontendUrl);
    errorUrl.searchParams.set("error", getErrorMessage(error));
    return new Response(null, {
      status: 302,
      headers: {
        Location: errorUrl.toString(),
      },
    });
  }
});

