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

/**
 * Get OAuth2Client instance (lazy initialization)
 * Throws error only when called if env vars are missing
 */
function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth environment variables are not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in your Convex environment variables."
    );
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

/**
 * Generate Google OAuth authorization URL
 * @param state - Optional state parameter for OAuth flow
 * @returns Authorization URL
 */
export function getGoogleAuthUrl(state = ""): string {
  const oAuth2Client = getOAuth2Client();
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
 * @returns User info from Google
 */
export async function getGoogleUser(code: string): Promise<{
  email: string | undefined;
  name: string | undefined;
  googleId: string | undefined;
  emailVerified: boolean | undefined;
  picture: string | undefined;
}> {
  const oAuth2Client = getOAuth2Client();
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
 * Handle Google ID token login (for mobile apps)
 * @param idToken - Google ID token from mobile app
 * @param name - Optional name override
 * @returns JWT token and user info
 */
export const handleGoogleIdTokenLogin = action({
  args: {
    idToken: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    token: string;
    userId: Id<"users">;
    email: string;
    name?: string;
  }> => {
    // Support both iOS and Android client IDs
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientIdIOS = process.env.GOOGLE_CLIENT_ID_IOS;
    const clientIdAndroid = process.env.GOOGLE_CLIENT_ID_ANDROID;
    
    const clientIds = [clientId].filter(Boolean) as string[];
    if (clientIdIOS) clientIds.push(clientIdIOS);
    if (clientIdAndroid) clientIds.push(clientIdAndroid);

    const oAuth2ClientForMobile = new OAuth2Client();

    // Verify ID token with Google
    const ticket = await oAuth2ClientForMobile.verifyIdToken({
      idToken: args.idToken,
      audience: clientIds,
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

    if (!user) {
      const userId = await ctx.runMutation(
        (internal as any).functions.auth.mutations.createUserInternal,
        {
          email: payload.email,
          name: args.name || payload.name || payload.email.split("@")[0],
          googleId: payload.sub,
          profilePic: payload.picture,
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
          name: payload.name,
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
  },
  handler: async (_ctx, args) => {
    return {
      url: getGoogleAuthUrl(args.state || ""),
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
  },
  handler: async (_ctx, args) => {
    return await getGoogleUser(args.code);
  },
});

