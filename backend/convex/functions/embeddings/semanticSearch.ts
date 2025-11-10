/**
 * Semantic search actions for user chat agent
 * Uses embeddings to find semantically similar tickets, quotes, and vendors
 */

"use node";

import OpenAI from "openai";
import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embedding for a user query
 */
async function generateQueryEmbedding(query: string): Promise<Array<number>> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });

  return response.data[0].embedding;
}

/**
 * Semantic search for tickets
 */
export const searchTicketsSemantic = internalAction({
  args: {
    userId: v.id("users"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<Array<Doc<"tickets"> & { _score: number }>> => {
    const limit = args.limit || 10;

    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(args.query);

    // Search tickets using vector similarity
    // Filter by userId to only search user's tickets
    const results = await ctx.vectorSearch("tickets", "by_embedding", {
      vector: queryEmbedding,
      limit,
      filter: (q) => q.eq("createdBy", args.userId),
    });

    // Get full ticket documents
    const tickets: Array<Doc<"tickets"> & { _score: number }> = await Promise.all(
      results.map(async (result) => {
        const ticket = await ctx.runQuery(
          (internal as any).functions.tickets.queries.getByIdInternal,
          { ticketId: result._id }
        );
        return { ...ticket!, _score: result._score };
      })
    );

    const validTickets = tickets.filter(
      (t): t is Doc<"tickets"> & { _score: number } => t !== null
    );

    // If we don't have enough results or no embeddings exist, fall back to text-based search
    if (validTickets.length < limit) {
      const allUserTickets = await ctx.runQuery(
        (internal as any).functions.tickets.queries.listByCreatorInternal,
        { userId: args.userId }
      );

      // Simple text matching as fallback
      const queryLower = args.query.toLowerCase();
      const textMatches = allUserTickets
        .filter((t) => {
          if (!t) return false;
          const text = [
            t.description,
            t.problemDescription,
            t.issueType,
            t.location,
            ...(t.predictedTags || []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return text.includes(queryLower);
        })
        .slice(0, limit - validTickets.length)
        .map((t) => ({ ...t!, _score: 0.5 })); // Lower score for text matches

      // Combine results, avoiding duplicates
      const existingIds = new Set(validTickets.map((t) => t._id));
      const newTickets = textMatches.filter((t) => !existingIds.has(t._id));
      return [...validTickets, ...newTickets];
    }

    return validTickets;
  },
});

/**
 * Semantic search for vendor quotes
 */
export const searchQuotesSemantic = internalAction({
  args: {
    userId: v.id("users"),
    query: v.string(),
    limit: v.optional(v.number()),
    ticketId: v.optional(v.id("tickets")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("received"),
        v.literal("selected"),
        v.literal("rejected"),
        v.literal("expired")
      )
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<Array<Doc<"vendorQuotes"> & { _score: number }>> => {
    const limit = args.limit || 10;

    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(args.query);

    // Build filter
    let filter: ((q: any) => any) | undefined;
    if (args.ticketId) {
      filter = (q: any) => q.eq("ticketId", args.ticketId);
    } else if (args.status) {
      filter = (q: any) => q.eq("status", args.status);
    }

    // Search quotes using vector similarity
    const results = await ctx.vectorSearch("vendorQuotes", "by_embedding", {
      vector: queryEmbedding,
      limit,
      filter,
    });

    // Get full quote documents and verify they belong to user's tickets
    const quotes: Array<Doc<"vendorQuotes"> & { _score: number }> = [];

    for (const result of results) {
      const quote = await ctx.runQuery(
        (internal as any).functions.vendorQuotes.queries.getByIdInternal,
        { quoteId: result._id }
      );

      if (!quote) continue;

      // Verify quote belongs to user's ticket
      const ticket = await ctx.runQuery(
        (internal as any).functions.tickets.queries.getByIdInternal,
        { ticketId: quote.ticketId }
      );

      if (ticket && ticket.createdBy === args.userId) {
        quotes.push({ ...quote, _score: result._score });
      }
    }

    return quotes;
  },
});

/**
 * Semantic search for vendors
 */
export const searchVendorsSemantic = internalAction({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    specialty: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<Array<Doc<"vendors"> & { _score: number }>> => {
    const limit = args.limit || 10;

    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(args.query);

    // Build filter
    const filter = args.specialty
      ? (q: any) => q.eq("specialty", args.specialty)
      : undefined;

    // Search vendors using vector similarity
    const results = await ctx.vectorSearch("vendors", "by_embedding", {
      vector: queryEmbedding,
      limit,
      filter,
    });

    // Get full vendor documents
    const vendors: Array<Doc<"vendors"> & { _score: number }> = await Promise.all(
      results.map(async (result) => {
        const vendor = await ctx.runQuery(
          (internal as any).functions.vendors.queries.getByIdInternal,
          { vendorId: result._id }
        );
        return { ...vendor!, _score: result._score };
      })
    );

    return vendors.filter(
      (v): v is Doc<"vendors"> & { _score: number } => v !== null
    );
  },
});

