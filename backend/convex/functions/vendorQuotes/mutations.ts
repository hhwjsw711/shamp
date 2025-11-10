/**
 * Vendor Quotes mutations
 * Handle vendor quote creation and updates
 */

import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

/**
 * Create a vendor quote from a vendor response
 */
export const createInternal = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    vendorId: v.id("vendors"),
    vendorOutreachId: v.id("vendorOutreach"),
    price: v.number(),
    currency: v.string(),
    estimatedDeliveryTime: v.number(),
    ratings: v.optional(v.number()),
    responseText: v.string(),
    quoteDocumentId: v.optional(v.id("_storage")), // Stored quote document
    quoteDocumentType: v.optional(v.string()), // Document type (pdf, image, etc.)
    scheduledDate: v.optional(v.number()), // When vendor can come to fix the issue (timestamp in milliseconds)
    fixDuration: v.optional(v.number()), // How long the fix will take (in hours)
  },
  handler: async (ctx, args): Promise<Id<"vendorQuotes">> => {
    const now = Date.now();

    const quoteId = await ctx.db.insert("vendorQuotes", {
      ticketId: args.ticketId,
      vendorId: args.vendorId,
      vendorOutreachId: args.vendorOutreachId,
      price: args.price,
      currency: args.currency,
      estimatedDeliveryTime: args.estimatedDeliveryTime,
      ratings: args.ratings,
      responseText: args.responseText,
      quoteDocumentId: args.quoteDocumentId,
      quoteDocumentType: args.quoteDocumentType,
      scheduledDate: args.scheduledDate,
      fixDuration: args.fixDuration,
      status: "received",
      responseReceivedAt: now,
      createdAt: now,
    });

    return quoteId;
  },
});

/**
 * Update vendor quote score (for ranking)
 */
export const updateScore = internalMutation({
  args: {
    quoteId: v.id("vendorQuotes"),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quoteId, {
      score: args.score,
    });
  },
});

/**
 * Update vendor quote status
 */
export const updateStatus = internalMutation({
  args: {
    quoteId: v.id("vendorQuotes"),
    status: v.union(
      v.literal("pending"),
      v.literal("received"),
      v.literal("selected"),
      v.literal("rejected"),
      v.literal("expired")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quoteId, {
      status: args.status,
    });
  },
});

