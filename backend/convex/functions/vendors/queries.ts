/**
 * Vendor queries - Internal and public queries for vendor data access
 */

import { internalQuery, query } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { validateUserId } from "../../utils/queryAuth";

/**
 * Get vendor by ID (internal)
 */
export const getByIdInternal = internalQuery({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.vendorId);
  },
});

/**
 * Get vendor by ID (public query with authorization)
 * SECURITY: Only returns vendors associated with user's tickets
 */
export const getById = query({
  args: {
    vendorId: v.id("vendors"),
    userId: v.id("users"), // Required for authorization
  },
  handler: async (ctx, args) => {
    // Validate userId exists
    await validateUserId(ctx, args.userId);
    
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) {
      return null;
    }
    
    // SECURITY: Verify vendor is associated with at least one of user's tickets
    // Check if vendor has quotes for user's tickets
    const userTickets = await ctx.db
      .query("tickets")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .collect();
    
    const ticketIds = userTickets.map((t) => t._id);
    
    // Check if vendor has quotes for any of user's tickets
    for (const ticketId of ticketIds) {
      const quote = await ctx.db
        .query("vendorQuotes")
        .withIndex("by_ticketId", (q) => q.eq("ticketId", ticketId))
        .filter((q) => q.eq(q.field("vendorId"), args.vendorId))
        .first();
      
      if (quote) {
        // Vendor is associated with user's ticket, return vendor
        return vendor;
      }
    }
    
    // Vendor not associated with user's tickets
    throw new Error("Unauthorized: Vendor not associated with user's tickets");
  },
});

/**
 * Get vendor by email (internal)
 */
export const getByEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vendors")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

/**
 * List all vendors (internal)
 */
export const listInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("vendors").collect();
  },
});

/**
 * List vendors associated with user's tickets (public query with authorization)
 * SECURITY: Only returns vendors that have quotes for user's tickets
 */
export const list = query({
  args: {
    userId: v.id("users"), // Required for authorization
  },
  handler: async (ctx, args) => {
    // Validate userId exists
    await validateUserId(ctx, args.userId);
    
    // Get all tickets for the user
    const userTickets = await ctx.db
      .query("tickets")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .collect();
    
    const ticketIds = userTickets.map((t) => t._id);
    
    // Get all vendor IDs that have quotes for user's tickets
    const vendorIds = new Set<Id<"vendors">>();
    const vendorToLatestQuote = new Map<Id<"vendors">, number>(); // Track most recent quote timestamp
    
    for (const ticketId of ticketIds) {
      const quotes = await ctx.db
        .query("vendorQuotes")
        .withIndex("by_ticketId", (q) => q.eq("ticketId", ticketId))
        .collect();
      
      for (const quote of quotes) {
        vendorIds.add(quote.vendorId);
        // Track the most recent quote timestamp for each vendor
        const currentLatest = vendorToLatestQuote.get(quote.vendorId) || 0;
        if (quote.createdAt > currentLatest) {
          vendorToLatestQuote.set(quote.vendorId, quote.createdAt);
        }
      }
    }
    
    // Fetch vendor documents
    const vendors = await Promise.all(
      Array.from(vendorIds).map((vendorId) => ctx.db.get(vendorId))
    );
    
    // Filter out nulls and sort by most recent quote timestamp (most recent first)
    const validVendors = vendors.filter((v) => v !== null) as Array<NonNullable<typeof vendors[0]>>;
    validVendors.sort((a, b) => {
      const aTimestamp = vendorToLatestQuote.get(a._id) || 0;
      const bTimestamp = vendorToLatestQuote.get(b._id) || 0;
      return bTimestamp - aTimestamp; // Descending order (most recent first)
    });
    
    return validVendors;
  },
});

