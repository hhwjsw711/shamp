/**
 * Vendor Outreach queries
 */

import { v } from "convex/values";
import { internalQuery, query } from "../../_generated/server";
import { validateUserId } from "../../utils/queryAuth";

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
 * Get all vendor outreach records for a ticket (public query with authorization)
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
    
    // Verify ticket exists and belongs to user
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    
    // SECURITY: Ensure ticket belongs to the requesting user
    if (ticket.createdBy !== args.userId) {
      throw new Error("Unauthorized: Ticket does not belong to user");
    }
    
    const outreachRecords = await ctx.db
      .query("vendorOutreach")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .collect();

    // Sort by emailSentAt descending (most recent first)
    outreachRecords.sort((a, b) => b.emailSentAt - a.emailSentAt);

    return outreachRecords;
  },
});

/**
 * Get vendor outreach by ticket ID and vendor ID (internal)
 */
export const getByTicketIdAndVendorIdInternal = internalQuery({
  args: {
    ticketId: v.id("tickets"),
    vendorId: v.id("vendors"),
  },
  handler: async (ctx, args) => {
    const outreachRecords = await ctx.db
      .query("vendorOutreach")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .collect();

    // Sort by emailSentAt descending (most recent first)
    outreachRecords.sort((a, b) => b.emailSentAt - a.emailSentAt);

    // Find the one matching the vendor ID
    return outreachRecords.find((o) => o.vendorId === args.vendorId) || null;
  },
});

