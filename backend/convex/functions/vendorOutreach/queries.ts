/**
 * Vendor Outreach queries
 */

import { v } from "convex/values";
import { internalQuery, query } from "../../_generated/server";

/**
 * Get vendor outreach by ID (internal)
 */
export const getByIdInternal = internalQuery({
  args: {
    outreachId: v.id("vendorOutreach"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.outreachId);
  },
});

/**
 * Get all vendor outreach records for a ticket
 */
export const getByTicketId = query({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, args) => {
    const outreachRecords = await ctx.db
      .query("vendorOutreach")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .collect();

    return outreachRecords;
  },
});

