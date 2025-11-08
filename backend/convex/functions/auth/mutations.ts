/**
 * Authentication mutations - Create and update users
 */

import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
// Note: Password/pin hashing should be done in actions, not mutations
import { NotFoundError } from "../../utils/errors";

/**
 * Create a new user account
 * @param email - User email
 * @param name - User name (optional)
 * @param orgName - Organization name (optional)
 * @param location - Location (optional)
 * @param hashedPassword - Hashed password (optional, for email/password auth)
 * @param googleId - Google OAuth ID (optional)
 * @param profilePic - Profile picture URL (optional)
 * @returns Created user ID
 */
export const createUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    orgName: v.optional(v.string()),
    location: v.optional(v.string()),
    hashedPassword: v.optional(v.string()),
    googleId: v.optional(v.string()),
    profilePic: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      orgName: args.orgName,
      location: args.location,
      hashedPassword: args.hashedPassword,
      googleId: args.googleId,
      profilePic: args.profilePic,
      emailVerified: args.googleId ? true : false, // Google accounts are pre-verified
      createdAt: Date.now(),
    });

    return userId;
  },
});

/**
 * Internal mutation to create user account (no auth required)
 */
export const createUserInternal = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    orgName: v.optional(v.string()),
    location: v.optional(v.string()),
    hashedPassword: v.optional(v.string()),
    googleId: v.optional(v.string()),
    profilePic: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      orgName: args.orgName,
      location: args.location,
      hashedPassword: args.hashedPassword,
      googleId: args.googleId,
      profilePic: args.profilePic,
      emailVerified: args.googleId ? true : false,
      createdAt: Date.now(),
    });

    return userId;
  },
});

/**
 * Update user information
 * @param userId - User ID
 * @param name - Updated name (optional)
 * @param orgName - Updated organization name (optional)
 * @param location - Updated location (optional)
 * @param profilePic - Updated profile picture URL (optional)
 * @param emailVerified - Updated email verified status (optional)
 */
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    orgName: v.optional(v.string()),
    location: v.optional(v.string()),
    profilePic: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    const updates: {
      name?: string;
      orgName?: string;
      location?: string;
      profilePic?: string;
      emailVerified?: boolean;
    } = {};

    if (args.name !== undefined) updates.name = args.name;
    if (args.orgName !== undefined) updates.orgName = args.orgName;
    if (args.location !== undefined) updates.location = args.location;
    if (args.profilePic !== undefined) updates.profilePic = args.profilePic;
    if (args.emailVerified !== undefined) updates.emailVerified = args.emailVerified;

    await ctx.db.patch(args.userId, updates);
  },
});

/**
 * Update user password
 * @param userId - User ID
 * @param hashedPassword - New hashed password
 */
export const updatePassword = mutation({
  args: {
    userId: v.id("users"),
    hashedPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    await ctx.db.patch(args.userId, {
      hashedPassword: args.hashedPassword,
    });
  },
});

/**
 * Update user pin
 * @param userId - User ID
 * @param pin - New hashed pin
 */
export const updatePin = mutation({
  args: {
    userId: v.id("users"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    await ctx.db.patch(args.userId, {
      pin: args.pin,
    });
  },
});

/**
 * Update last login timestamp
 * @param userId - User ID
 */
export const updateLastLogin = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastLoginAt: Date.now(),
    });
  },
});

/**
 * Link Google account to existing user
 * @param userId - User ID
 * @param googleId - Google OAuth ID
 * @param name - Name from Google (optional)
 * @param profilePic - Profile picture URL from Google (optional)
 */
export const linkGoogleAccount = mutation({
  args: {
    userId: v.id("users"),
    googleId: v.string(),
    name: v.optional(v.string()),
    profilePic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    const updates: {
      googleId: string;
      name?: string;
      profilePic?: string;
      emailVerified?: boolean;
    } = {
      googleId: args.googleId,
      emailVerified: true, // Google accounts are verified
    };

    if (args.name && !user.name) {
      updates.name = args.name;
    }
    if (args.profilePic && !user.profilePic) {
      updates.profilePic = args.profilePic;
    }

    await ctx.db.patch(args.userId, updates);
  },
});

/**
 * Internal mutation to link Google account (no auth required)
 */
export const linkGoogleAccountInternal = mutation({
  args: {
    userId: v.id("users"),
    googleId: v.string(),
    name: v.optional(v.string()),
    profilePic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    const updates: {
      googleId: string;
      name?: string;
      profilePic?: string;
      emailVerified?: boolean;
    } = {
      googleId: args.googleId,
      emailVerified: true,
    };

    if (args.name && !user.name) {
      updates.name = args.name;
    }
    if (args.profilePic && !user.profilePic) {
      updates.profilePic = args.profilePic;
    }

    await ctx.db.patch(args.userId, updates);
  },
});

