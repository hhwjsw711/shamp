/**
 * Embedding mutations
 * Internal mutations for updating embeddings in database
 */

import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";

export const updateTicketEmbedding = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ticketId, {
      embedding: args.embedding,
    });
  },
});

export const updateVendorEmbedding = internalMutation({
  args: {
    vendorId: v.id("vendors"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.vendorId, {
      embedding: args.embedding,
    });
  },
});

export const updateConversationEmbedding = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      embedding: args.embedding,
    });
  },
});

export const updateVendorOutreachEmbedding = internalMutation({
  args: {
    outreachId: v.id("vendorOutreach"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.outreachId, {
      embedding: args.embedding,
    });
  },
});

export const updateVendorQuoteEmbedding = internalMutation({
  args: {
    quoteId: v.id("vendorQuotes"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quoteId, {
      embedding: args.embedding,
    });
  },
});

