/**
 * Session mutations - Create, update, and delete sessions
 */

import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { SESSION_EXPIRY_MS } from "../../utils/constants";

/**
 * Create a new session
 * @param userId - User ID
 * @param sessionToken - JWT session token
 * @param ipAddress - IP address (optional)
 * @param userAgent - User agent string (optional)
 * @returns Created session ID
 */
export const createSession = mutation({
  args: {
    userId: v.id("users"),
    sessionToken: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"sessions">> => {
    const expiresAt = Date.now() + SESSION_EXPIRY_MS;

    const sessionId = await ctx.db.insert("sessions", {
      userId: args.userId,
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
 * Delete a session
 * @param sessionToken - Session token to delete
 */
export const deleteSession = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
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
 * Delete session by ID
 * @param sessionId - Session ID to delete
 */
export const deleteSessionById = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.sessionId);
  },
});

/**
 * Delete all sessions for a user
 * @param userId - User ID
 */
export const deleteSessionsByUserId = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
  },
});

/**
 * Delete expired sessions
 * This should be called periodically to clean up old sessions
 */
export const deleteExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredSessions = await ctx.db
      .query("sessions")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .collect();

    for (const session of expiredSessions) {
      await ctx.db.delete(session._id);
    }

    return { deleted: expiredSessions.length };
  },
});

/**
 * Update session expiration
 * @param sessionToken - Session token
 * @param expiresAt - New expiration timestamp
 */
export const updateSessionExpiry = mutation({
  args: {
    sessionToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionToken", (q) =>
        q.eq("sessionToken", args.sessionToken)
      )
      .first();

    if (session) {
      await ctx.db.patch(session._id, {
        expiresAt: args.expiresAt,
      });
    }
  },
});

