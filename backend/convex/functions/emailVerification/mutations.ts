/**
 * Email verification mutations
 */

import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { CODE_EXPIRY_MS } from "../../utils/constants";

/**
 * Create email verification code
 * @param userId - User ID
 * @param email - Email address to verify
 * @param code - 6-digit verification code
 * @returns Created verification code ID
 */
export const createVerificationCode = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"emailVerificationCodes">> => {
    const expiresAt = Date.now() + CODE_EXPIRY_MS;

    // Delete any existing unverified codes for this user
    const existingCodes = await ctx.db
      .query("emailVerificationCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("verified"), true))
      .collect();

    for (const existingCode of existingCodes) {
      await ctx.db.delete(existingCode._id);
    }

    const codeId = await ctx.db.insert("emailVerificationCodes", {
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
 * Mark verification code as verified
 * @param codeId - Verification code ID
 */
export const markCodeAsVerified = mutation({
  args: { codeId: v.id("emailVerificationCodes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.codeId, {
      verified: true,
    });
  },
});

/**
 * Delete verification code
 */
export const deleteVerificationCode = mutation({
  args: { codeId: v.id("emailVerificationCodes") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.codeId);
  },
});

/**
 * Internal mutation to create verification code (no auth required)
 */
export const createVerificationCodeInternal = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"emailVerificationCodes">> => {
    const expiresAt = Date.now() + CODE_EXPIRY_MS;

    // Delete any existing unverified codes for this user
    const existingCodes = await ctx.db
      .query("emailVerificationCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("verified"), true))
      .collect();

    for (const existingCode of existingCodes) {
      await ctx.db.delete(existingCode._id);
    }

    const codeId = await ctx.db.insert("emailVerificationCodes", {
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
 * Internal mutation to mark code as verified (no auth required)
 */
export const markCodeAsVerifiedInternal = mutation({
  args: { codeId: v.id("emailVerificationCodes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.codeId, {
      verified: true,
    });
  },
});

