/**
 * PIN management mutations
 * Internal mutations for PIN management (no Node.js APIs)
 */

import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Set PIN for user (internal mutation)
 * Called by actions that have already hashed the PIN
 */
export const setPinInternal = internalMutation({
  args: {
    userId: v.id("users"),
    hashedPin: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.userId, {
      pin: args.hashedPin,
      pinCreatedAt: Date.now(),
      pinEnabled: true,
    });
  },
});

