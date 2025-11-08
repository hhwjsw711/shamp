/**
 * Vendor Quotes queries
 */

import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/**
 * Get vendor quote by ID (internal)
 */
export const getByIdInternal = internalQuery({
  args: {
    quoteId: v.id("vendorQuotes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.quoteId);
  },
});

/**
 * Get all vendor quotes for a ticket (internal)
 */
export const getByTicketIdInternal = internalQuery({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, args) => {
    const quotes = await ctx.db
      .query("vendorQuotes")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .collect();

    return quotes;
  },
});

