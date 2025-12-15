/**
 * Authentication actions - Google OAuth and token handling
 * These actions run in Node.js environment and can use external libraries
 */

"use node";

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { OAuth2Client } from "google-auth-library";
import { api, internal } from "../../_generated/api";
import { generateToken } from "../../utils/authNode";
import type { Id } from "../../_generated/dataModel";
import { formatName } from "../../utils/nameUtils";

/**
 * Get OAuth2Client instance (lazy initialization)
 * Throws error only when called if env vars are missing
 */
function getOAuth2Client(redirectUriOverride?: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const frontendUrl = process.env.FRONTEND_URL;
  // Best practice: have Google redirect back to the SAME ORIGIN as the app,
  // so the callback response can set a first-party HttpOnly session cookie.
  // This should be your deployed app URL + "/api/auth/callback/google".
  const computedRedirectUri = frontendUrl
    ? new URL("/api/auth/callback/google", frontendUrl).toString()
    : undefined;
  const redirectUri =
    redirectUriOverride || computedRedirectUri || process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth environment variables are not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Also set FRONTEND_URL (preferred) or GOOGLE_REDIRECT_URI."
    );
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

/**
 * Generate Google OAuth authorization URL
 * @param state - Optional state parameter for OAuth flow
 * @param redirectUriOverride - Optional redirect URI override (must match Google Console)
 * @returns Authorization URL
 */
export function getGoogleAuthUrl(state = "", redirectUriOverride?: string): string {
  const oAuth2Client = getOAuth2Client(redirectUriOverride);
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["profile", "email"],
    prompt: "select_account",
    state,
  });
}

/**
 * Exchange authorization code for user info
 * @param code - Authorization code from Google OAuth callback
 * @param redirectUriOverride - Optional redirect URI override (must match auth request)
 * @returns User info from Google
 */
export async function getGoogleUser(
  code: string,
  redirectUriOverride?: string
): Promise<{
  email: string | undefined;
  name: string | undefined;
  googleId: string | undefined;
  emailVerified: boolean | undefined;
  picture: string | undefined;
}> {
  const oAuth2Client = getOAuth2Client(redirectUriOverride);
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  const ticket = await oAuth2Client.verifyIdToken({
    idToken: tokens.id_token as string,
    audience: clientId,
  });

  const payload = ticket.getPayload();

  return {
    email: payload?.email,
    name: payload?.name,
    googleId: payload?.sub,
    emailVerified: payload?.email_verified,
    picture: payload?.picture,
  };
}

/**
 * Handle Google ID token login (for web apps - removed mobile support)
 * @param idToken - Google ID token from web app
 * @returns JWT token and user info
 */
export const handleGoogleIdTokenLogin = action({
  args: {
    idToken: v.string(),
  },
  handler: async (ctx, args): Promise<{
    token: string;
    userId: Id<"users">;
    email: string;
    name?: string;
  }> => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      throw new Error("Google OAuth client ID is not configured");
    }

    const oAuth2Client = new OAuth2Client();

    // Verify ID token with Google
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: args.idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      throw new Error("Failed to get Google user info from id token");
    }

    // Find or create user
    let user = await ctx.runQuery(
      (internal as any).functions.auth.queries.findUserByEmailInternal,
      { email: payload.email }
    );

    // Format name from Google (sanitizes quotes, brackets, etc.)
    const formattedName = formatName(payload.name) || formatName(payload.email.split("@")[0]);

    if (!user) {
      const userId = await ctx.runMutation(
        (internal as any).functions.auth.mutations.createUserInternal,
        {
          email: payload.email,
          name: formattedName,
          googleId: payload.sub,
          profilePic: payload.picture,
          emailVerified: true,
        }
      );
      user = await ctx.runQuery(
        (internal as any).functions.auth.queries.getUserByIdInternal,
        { userId }
      );
    } else if (!user.googleId && payload.sub) {
      // Link Google account to existing user
      await ctx.runMutation(
        (internal as any).functions.auth.mutations.linkGoogleAccountInternal,
        {
          userId: user._id,
          googleId: payload.sub,
          name: formattedName || user.name,
          profilePic: payload.picture,
        }
      );
      user = await ctx.runQuery(
        (internal as any).functions.auth.queries.getUserByIdInternal,
        { userId: user._id }
      );
    }

    if (!user) {
      throw new Error("Failed to create or load user");
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      email: user.email,
      name: user.name,
      provider: "google",
    });

    // Update last login
    await ctx.runMutation(
      (api as any).functions.auth.mutations.updateLastLogin,
      {
        userId: user._id,
      }
    );

    return {
      token,
      userId: user._id,
      email: user.email,
      name: user.name,
    };
  },
});

/**
 * Action to get Google OAuth URL
 * @param state - Optional state parameter
 * @returns OAuth URL
 */
export const getGoogleAuthUrlAction = action({
  args: {
    state: v.optional(v.string()),
    redirectUri: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    return {
      url: getGoogleAuthUrl(args.state || "", args.redirectUri),
    };
  },
});

/**
 * Action to exchange Google OAuth code for user info
 * @param code - Authorization code from Google OAuth callback
 * @returns User info from Google
 */
export const getGoogleUserAction = action({
  args: {
    code: v.string(),
    redirectUri: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    return await getGoogleUser(args.code, args.redirectUri);
  },
});

