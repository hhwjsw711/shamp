/**
 * Firecrawl Results queries
 * Retrieve vendor discovery results
 */

import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/**
 * Get firecrawl results by ID (internal)
 */
export const getByIdInternal = internalQuery({
  args: {
    resultId: v.id("firecrawlResults"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.resultId);
  },
});

/**
 * Get firecrawl results by ticket ID (internal)
 */
export const getByTicketIdInternal = internalQuery({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("firecrawlResults")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .first();
  },
});

