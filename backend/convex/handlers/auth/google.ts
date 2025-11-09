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

    // Get origin from request header for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await _ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    // Use origin from request if available, otherwise fallback to FRONTEND_URL
    const allowedOrigin = origin || frontendUrl;

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

    const isNewUser = !user;
    let formattedName = formatName(googleUser.name);

    if (!user) {
      // Create new user account with Google info (emailVerified is true for Google accounts)
      const userId = await ctx.runMutation(
        (internal as any).functions.auth.mutations.createUserInternal,
        {
          email: googleUser.email,
          name: formattedName,
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
      await ctx.runMutation(
        (internal as any).functions.auth.mutations.linkGoogleAccountInternal,
        {
          userId: user._id,
          googleId: googleUser.googleId,
          name: formattedName || user.name,
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
      (api as any).functions.auth.authHelpers.generateTokenAction,
      {
        userId: user._id,
        email: user.email,
        name: user.name,
        provider: "google",
      }
    );

    // Get frontend URL for cookie configuration
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";

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

    // For localhost HTTP: browsers reject cookies in cross-origin redirects
    // Solution: Pass token as URL parameter and let frontend set the cookie
    // For ngrok/production (HTTPS): cookies work properly, no URL token needed
    const isLocalhost = frontendUrl.includes("localhost") || frontendUrl.includes("127.0.0.1");
    const isNgrok = frontendUrl.includes("ngrok.io") || frontendUrl.includes("ngrok-free.app") || frontendUrl.includes("ngrok-free.dev");
    const hasHttps = isNgrok || frontendUrl.startsWith("https://");
    
    // Only use URL token workaround for localhost HTTP (not HTTPS/ngrok)
    if (isLocalhost && !hasHttps) {
      redirectUrl.searchParams.set("token", token);
      // Still try to set cookie, but frontend will handle it if cookie fails
      return new Response(null, {
        status: 302,
        headers: {
          Location: redirectUrl.toString(),
          "Set-Cookie": cookieHeader,
        },
      });
    }

    // For ngrok/production (HTTPS): use secure cookies only
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

