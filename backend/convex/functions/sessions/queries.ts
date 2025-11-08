/**
 * Session queries - Get session information
 */

import { query } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

/**
 * Get session by token
 * @param sessionToken - Session token (JWT)
 * @returns Session document or null
 */
export const getSessionByToken = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_sessionToken", (q) =>
        q.eq("sessionToken", args.sessionToken)
      )
      .first();
  },
});

/**
 * Get all sessions for a user
 * @param userId - User ID
 * @returns Array of session documents
 */
export const getSessionsByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Internal query to get session by token (no auth required)
 */
export const getSessionByTokenInternal = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_sessionToken", (q) =>
        q.eq("sessionToken", args.sessionToken)
      )
      .first();
  },
});

