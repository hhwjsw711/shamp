/**
 * Authentication helper actions for Node.js operations
 * These actions can be called from HTTP handlers to perform Node.js operations
 */

"use node";

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { generateToken, createSecureCookie, comparePassword, hashPassword, verifyToken, extractSessionToken, createDeleteCookie } from "../../utils/authNode";
import type { JWTPayload } from "../../utils/authHelpers";

/**
 * Compare password action (for HTTP handlers)
 */
export const comparePasswordAction = action({
  args: {
    password: v.string(),
    hash: v.string(),
  },
  handler: async (_ctx, args): Promise<boolean> => {
    return await comparePassword(args.password, args.hash);
  },
});

/**
 * Hash password action (for HTTP handlers)
 */
export const hashPasswordAction = action({
  args: {
    password: v.string(),
  },
  handler: async (_ctx, args): Promise<string> => {
    return await hashPassword(args.password);
  },
});

/**
 * Generate token action (for HTTP handlers)
 */
export const generateTokenAction = action({
  args: {
    userId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    provider: v.union(v.literal("google"), v.literal("email"), v.literal("pin")),
  },
  handler: async (_ctx, args): Promise<string> => {
    const payload: JWTPayload = {
      userId: args.userId,
      email: args.email,
      name: args.name,
      provider: args.provider,
    };
    return generateToken(payload);
  },
});

/**
 * Verify token action (for HTTP handlers)
 */
export const verifyTokenAction = action({
  args: {
    token: v.string(),
  },
  handler: async (_ctx, args): Promise<JWTPayload | null> => {
    return verifyToken(args.token);
  },
});

/**
 * Extract session token from cookie header action (for HTTP handlers)
 */
export const extractSessionTokenAction = action({
  args: {
    cookieHeader: v.union(v.string(), v.null()),
  },
  handler: async (_ctx, args): Promise<string | null> => {
    return extractSessionToken(args.cookieHeader);
  },
});

/**
 * Create secure cookie action (for HTTP handlers)
 */
export const createSecureCookieAction = action({
  args: {
    token: v.string(),
    maxAge: v.optional(v.number()),
  },
  handler: async (_ctx, args): Promise<string> => {
    return createSecureCookie(args.token, args.maxAge);
  },
});

/**
 * Create delete cookie action (for HTTP handlers)
 */
export const createDeleteCookieAction = action({
  args: {},
  handler: async (_ctx): Promise<string> => {
    return createDeleteCookie();
  },
});

