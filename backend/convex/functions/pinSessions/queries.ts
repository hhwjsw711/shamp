/**
 * PIN session queries
 */

import { internalQuery } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Get PIN session by token (internal query)
 */
export const getPinSessionByTokenInternal = internalQuery({
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

    if (!session) {
      return null;
    }

    // Check if expired
    if (session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  },
});

