/**
 * Authentication queries - Find users by various criteria
 */

import { query, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import { validateUserId } from "../../utils/queryAuth";

/**
 * Find user by email
 * Note: This is used for authentication flows, so it remains public but doesn't expose sensitive data
 * @param email - Email address to search for
 * @returns User document or null (without sensitive fields)
 */
export const findUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    if (!user) return null;
    
    // Don't expose sensitive fields
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      orgName: user.orgName,
      location: user.location,
      profilePic: user.profilePic,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
    };
  },
});

/**
 * Find user by Google ID
 * Note: This is used for authentication flows, so it remains public but doesn't expose sensitive data
 * @param googleId - Google OAuth ID
 * @returns User document or null (without sensitive fields)
 */
export const findUserByGoogleId = query({
  args: { googleId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
      .first();
    
    if (!user) return null;
    
    // Don't expose sensitive fields
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      orgName: user.orgName,
      location: user.location,
      profilePic: user.profilePic,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
    };
  },
});

/**
 * Get user by ID (public query with authorization)
 * SECURITY: Users can only get their own user data
 * Used for real-time user data updates
 * @param userId - User ID (must match requesting user)
 * @param requestingUserId - ID of the user making the request
 * @returns User document or null (without sensitive fields)
 */
export const getUserById = query({
  args: { 
    userId: v.id("users"),
    requestingUserId: v.id("users"), // Required for authorization
  },
  handler: async (ctx, args) => {
    // Validate requesting user exists
    await validateUserId(ctx, args.requestingUserId);
    
    // SECURITY: Users can only get their own user data
    if (args.userId !== args.requestingUserId) {
      throw new Error("Unauthorized: Cannot access other user's data");
    }
    
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    
    // Don't expose sensitive fields
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      orgName: user.orgName,
      location: user.location,
      profilePic: user.profilePic,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
    };
  },
});

/**
 * Get current user (public query with authorization)
 * Simplified version that only requires userId (assumes user is querying themselves)
 * Used for real-time user data updates after initial authentication
 * @param userId - User ID (user querying their own data)
 * @returns User document or null (without sensitive fields)
 */
export const getCurrentUser = query({
  args: { 
    userId: v.id("users"), // User querying their own data
  },
  handler: async (ctx, args) => {
    // Validate userId exists
    await validateUserId(ctx, args.userId);
    
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    
    // Don't expose sensitive fields
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      orgName: user.orgName,
      location: user.location,
      profilePic: user.profilePic,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
    };
  },
});

/**
 * Internal query to get user by ID (no auth required)
 */
export const getUserByIdInternal = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Internal query to find user by email (no auth required)
 */
export const findUserByEmailInternal = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

/**
 * Get all users with PIN enabled (internal query)
 * Used for PIN validation
 */
export const getAllUsersWithPinInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("pinEnabled"), true))
      .collect();
  },
});


