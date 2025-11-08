/**
 * Conversation queries - Internal queries for conversation data access
 */

import { internalQuery } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Get conversation by ID (internal)
 */
export const getByIdInternal = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

/**
 * Get conversation by ticket ID (internal)
 */
export const getByTicketIdInternal = internalQuery({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .first();
  },
});

