/**
 * Email verification queries
 */

import { query } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

/**
 * Get verification code by user ID
 * @param userId - User ID
 * @returns Verification code document or null
 */
export const getVerificationCodeByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailVerificationCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("verified"), undefined))
      .order("desc")
      .first();
  },
});

/**
 * Get verification code by code string
 * @param code - Verification code
 * @returns Verification code document or null
 */
export const getVerificationCodeByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailVerificationCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

/**
 * Internal query to get verification code by code (no auth required)
 */
export const getVerificationCodeByCodeInternal = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailVerificationCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

