/**
 * Firecrawl Results queries
 * Retrieve vendor discovery results
 */

import { v } from "convex/values";
import { internalQuery, query } from "../../_generated/server";
import { validateUserId } from "../../utils/queryAuth";

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

/**
 * Get firecrawl results by ticket ID (public query with authorization)
 * SECURITY: Validates that the ticket belongs to the requesting user
 */
export const getByTicketId = query({
  args: {
    ticketId: v.id("tickets"),
    userId: v.id("users"), // Required for authorization
  },
  handler: async (ctx, args) => {
    // Validate userId exists
    await validateUserId(ctx, args.userId);
    
    // Get ticket to verify ownership
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      return null;
    }
    
    // SECURITY: Ensure ticket belongs to the requesting user
    if (ticket.createdBy !== args.userId) {
      throw new Error("Unauthorized: Ticket does not belong to user");
    }
    
    // Get firecrawl results for this ticket
    const results = await ctx.db
      .query("firecrawlResults")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .first();
    
    return results;
  },
});

