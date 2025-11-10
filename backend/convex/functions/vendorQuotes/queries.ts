/**
 * Vendor Quotes queries
 */

import { v } from "convex/values";
import { internalQuery, query } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";

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

/**
 * Get all vendor quotes for a ticket (public query with pagination)
 */
export const getByTicketId = query({
  args: {
    ticketId: v.id("tickets"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    let quotes = await ctx.db
      .query("vendorQuotes")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .collect();

    // Sort by createdAt descending
    quotes.sort((a, b) => b.createdAt - a.createdAt);

    // Apply cursor-based pagination if provided
    if (args.cursor) {
      const cursorQuote = await ctx.db.get(args.cursor as any);
      if (cursorQuote) {
        const cursorIndex = quotes.findIndex((q) => q._id === cursorQuote._id);
        if (cursorIndex >= 0) {
          quotes = quotes.slice(cursorIndex + 1);
        }
      }
    }

    // Apply limit
    const paginatedQuotes = quotes.slice(0, limit);
    const nextCursor =
      quotes.length > limit ? paginatedQuotes[paginatedQuotes.length - 1]._id : null;

    return {
      quotes: paginatedQuotes,
      nextCursor: nextCursor ? (nextCursor as string) : null,
      hasMore: quotes.length > limit,
    };
  },
});

/**
 * Get all vendor quotes by vendor ID (internal)
 */
export const getByVendorIdInternal = internalQuery({
  args: {
    vendorId: v.id("vendors"),
  },
  handler: async (ctx, args) => {
    const quotes = await ctx.db
      .query("vendorQuotes")
      .withIndex("by_vendorId", (q) => q.eq("vendorId", args.vendorId))
      .collect();

    return quotes;
  },
});

/**
 * Get all vendor quotes by status (internal)
 */
export const getByStatusInternal = internalQuery({
  args: {
    status: v.union(
      v.literal("pending"),
      v.literal("received"),
      v.literal("selected"),
      v.literal("rejected"),
      v.literal("expired")
    ),
  },
  handler: async (ctx, args) => {
    const quotes = await ctx.db
      .query("vendorQuotes")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();

    return quotes;
  },
});

/**
 * Get all vendor quotes for a user's tickets (internal)
 */
export const getByUserIdInternal = internalQuery({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all tickets for the user
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .collect();

    const ticketIds = tickets.map((t) => t._id);

    // Get all quotes for these tickets
    let allQuotes: Array<Doc<"vendorQuotes">> = [];
    for (const ticketId of ticketIds) {
      const quotes = await ctx.db
        .query("vendorQuotes")
        .withIndex("by_ticketId", (q) => q.eq("ticketId", ticketId))
        .collect();
      allQuotes = allQuotes.concat(quotes);
    }

    // Sort by createdAt descending
    allQuotes.sort((a, b) => b.createdAt - a.createdAt);

    // Apply cursor-based pagination if provided
    if (args.cursor) {
      const cursorQuote = await ctx.db.get(args.cursor as any);
      if (cursorQuote) {
        const cursorIndex = allQuotes.findIndex((q) => q._id === cursorQuote._id);
        if (cursorIndex >= 0) {
          allQuotes = allQuotes.slice(cursorIndex + 1);
        }
      }
    }

    // Apply limit
    const limit = args.limit || 50;
    const paginatedQuotes = allQuotes.slice(0, limit);
    const nextCursor =
      allQuotes.length > limit
        ? (paginatedQuotes[paginatedQuotes.length - 1]._id as string)
        : null;

    return {
      quotes: paginatedQuotes,
      nextCursor,
      hasMore: allQuotes.length > limit,
    };
  },
});

/**
 * Get all vendor quotes (internal) - for admin/system use
 */
export const getAllInternal = internalQuery({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("received"),
        v.literal("selected"),
        v.literal("rejected"),
        v.literal("expired")
      )
    ),
    vendorId: v.optional(v.id("vendors")),
  },
  handler: async (ctx, args) => {
    let quotes: Array<Doc<"vendorQuotes">>;

    if (args.status) {
      quotes = await ctx.db
        .query("vendorQuotes")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else if (args.vendorId) {
      quotes = await ctx.db
        .query("vendorQuotes")
        .withIndex("by_vendorId", (q) => q.eq("vendorId", args.vendorId!))
        .collect();
    } else {
      // Get all quotes (no index, so we'll need to collect all)
      quotes = await ctx.db.query("vendorQuotes").collect();
    }

    // Sort by createdAt descending
    quotes.sort((a, b) => b.createdAt - a.createdAt);

    // Apply cursor-based pagination if provided
    if (args.cursor) {
      const cursorQuote = await ctx.db.get(args.cursor as any);
      if (cursorQuote) {
        const cursorIndex = quotes.findIndex((q) => q._id === cursorQuote._id);
        if (cursorIndex >= 0) {
          quotes = quotes.slice(cursorIndex + 1);
        }
      }
    }

    // Apply limit
    const limit = args.limit || 50;
    const paginatedQuotes = quotes.slice(0, limit);
    const nextCursor =
      quotes.length > limit
        ? (paginatedQuotes[paginatedQuotes.length - 1]._id as string)
        : null;

    return {
      quotes: paginatedQuotes,
      nextCursor,
      hasMore: quotes.length > limit,
    };
  },
});

