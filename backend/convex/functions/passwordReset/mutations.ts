/**
 * Password reset mutations
 */

import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { CODE_EXPIRY_MS } from "../../utils/constants";

/**
 * Create password reset code
 * @param userId - User ID
 * @param email - Email address
 * @param code - 6-digit reset code
 * @returns Created reset code ID
 */
export const createResetCode = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"passwordResetCodes">> => {
    const expiresAt = Date.now() + CODE_EXPIRY_MS;

    // Delete any existing unused codes for this user
    const existingCodes = await ctx.db
      .query("passwordResetCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("used"), true))
      .collect();

    for (const existingCode of existingCodes) {
      await ctx.db.delete(existingCode._id);
    }

    const codeId = await ctx.db.insert("passwordResetCodes", {
      userId: args.userId,
      email: args.email,
      code: args.code,
      expiresAt,
      createdAt: Date.now(),
    });

    return codeId;
  },
});

/**
 * Mark reset code as used
 * @param codeId - Reset code ID
 */
export const markCodeAsUsed = mutation({
  args: { codeId: v.id("passwordResetCodes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.codeId, {
      used: true,
    });
  },
});

/**
 * Internal mutation to create reset code (no auth required)
 */
export const createResetCodeInternal = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"passwordResetCodes">> => {
    const expiresAt = Date.now() + CODE_EXPIRY_MS;

    // Delete any existing unused codes for this user
    const existingCodes = await ctx.db
      .query("passwordResetCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("used"), true))
      .collect();

    for (const existingCode of existingCodes) {
      await ctx.db.delete(existingCode._id);
    }

    const codeId = await ctx.db.insert("passwordResetCodes", {
      userId: args.userId,
      email: args.email,
      code: args.code,
      expiresAt,
      createdAt: Date.now(),
    });

    return codeId;
  },
});

/**
 * Internal mutation to mark code as used (no auth required)
 */
export const markCodeAsUsedInternal = mutation({
  args: { codeId: v.id("passwordResetCodes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.codeId, {
      used: true,
    });
  },
});

