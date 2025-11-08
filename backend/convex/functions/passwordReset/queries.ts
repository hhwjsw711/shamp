/**
 * Password reset queries
 */

import { query } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

/**
 * Get password reset code by user ID
 * @param userId - User ID
 * @returns Password reset code document or null
 */
export const getResetCodeByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("passwordResetCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("used"), true))
      .order("desc")
      .first();
  },
});

/**
 * Get password reset code by code string
 * @param code - Reset code
 * @returns Password reset code document or null
 */
export const getResetCodeByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("passwordResetCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

/**
 * Internal query to get reset code by code (no auth required)
 */
export const getResetCodeByCodeInternal = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("passwordResetCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

