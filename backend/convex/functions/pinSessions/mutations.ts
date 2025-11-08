/**
 * PIN session mutations
 * Manage temporary sessions for PIN-based ticket submission
 */

import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

const PIN_SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create PIN session (internal mutation)
 */
export const createPinSessionInternal = internalMutation({
  args: {
    pinOwnerId: v.id("users"),
    sessionToken: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"pinSessions">> => {
    const expiresAt = Date.now() + PIN_SESSION_EXPIRY_MS;

    const sessionId = await ctx.db.insert("pinSessions", {
      pinOwnerId: args.pinOwnerId,
      sessionToken: args.sessionToken,
      expiresAt,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      createdAt: Date.now(),
    });

    return sessionId;
  },
});

/**
 * Delete PIN session (internal mutation)
 */
export const deletePinSessionInternal = internalMutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("pinSessions")
      .withIndex("by_sessionToken", (q) =>
        q.eq("sessionToken", args.sessionToken)
      )
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

/**
 * Delete expired PIN sessions (internal mutation)
 */
export const deleteExpiredPinSessionsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredSessions = await ctx.db
      .query("pinSessions")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .collect();

    for (const session of expiredSessions) {
      await ctx.db.delete(session._id);
    }

    return { deleted: expiredSessions.length };
  },
});

