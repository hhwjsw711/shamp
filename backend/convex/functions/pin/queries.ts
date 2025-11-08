/**
 * PIN queries
 */

import { internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

/**
 * Get user PIN status (internal)
 */
export const getUserPinStatusInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    return {
      hasPin: !!user.pin,
      pinEnabled: user.pinEnabled ?? false,
      pinCreatedAt: user.pinCreatedAt,
    };
  },
});


