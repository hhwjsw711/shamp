/**
 * Semantic search actions for user chat agent
 * Uses embeddings to find semantically similar tickets, quotes, and vendors
 * Optimized to use direct queries when possible, embeddings only for semantic queries
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
 * Check if query is simple enough to use direct database queries instead of embeddings
 * Simple queries: exact status, location, or simple keywords
 */
function isSimpleQuery(query: string): boolean {
  const simplePatterns = [
    /^(all|show|list|get)\s+(tickets|quotes|vendors)/i,
    /^(pending|processing|fixed|closed|analyzed)\s+(tickets?)?/i,
    /^(received|selected|rejected|pending)\s+(quotes?)?/i,
    /^tickets?\s+(pending|processing|fixed|closed|analyzed)/i,
    /^quotes?\s+(received|selected|rejected|pending)/i,
  ];
  
  return simplePatterns.some(pattern => pattern.test(query.trim()));
}

/**
 * Generate embedding for a user query (with simple caching check)
 * Note: For production, consider adding a proper cache table for query embeddings
 */
async function generateQueryEmbedding(query: string): Promise<Array<number>> {
  // Normalize query for potential caching (lowercase, trim)
  const normalizedQuery = query.toLowerCase().trim();
  
  // For very short queries, skip embedding and use text search
  if (normalizedQuery.length < 3) {
    throw new Error("Query too short for semantic search");
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small", // Cheapest model: $0.02 per 1M tokens
    input: normalizedQuery,
  });

  return response.data[0].embedding;
}

/**
 * Semantic search for tickets
 * Optimized: Uses direct queries for simple requests, embeddings for semantic queries
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
    const queryLower = args.query.toLowerCase().trim();

    // Check if this is a simple query that can use direct database queries
    if (isSimpleQuery(args.query)) {
      // Extract status from query if present
      const statusMatch = queryLower.match(/(pending|processing|fixed|closed|analyzed|vendors_available|vendor_selected|vendor_scheduled)/);
      const status = statusMatch ? statusMatch[1] : null;

      // Use direct query for simple requests
      let tickets: Array<Doc<"tickets">>;
      if (status) {
        tickets = await ctx.runQuery(
          (internal as any).functions.tickets.queries.listByStatusInternal,
          { status }
        );
      } else {
        tickets = await ctx.runQuery(
          (internal as any).functions.tickets.queries.listByCreatorInternal,
          { userId: args.userId }
        );
      }

      // Filter to user's tickets and apply limit
      tickets = tickets
        .filter((t) => t.createdBy === args.userId)
        .slice(0, limit);

      return tickets.map((t) => ({ ...t, _score: 1.0 }));
    }

    // For semantic queries, use embeddings
    try {
      const queryEmbedding = await generateQueryEmbedding(args.query);

      // Search tickets using vector similarity
      const results = await ctx.vectorSearch("tickets", "by_embedding", {
        vector: queryEmbedding,
        limit: limit * 2, // Get more for filtering
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

      // If we don't have enough results, fall back to text-based search
      if (validTickets.length < limit) {
        const allUserTickets = await ctx.runQuery(
          (internal as any).functions.tickets.queries.listByCreatorInternal,
          { userId: args.userId }
        );

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
          .map((t) => ({ ...t!, _score: 0.5 }));

        const existingIds = new Set(validTickets.map((t) => t._id));
        const newTickets = textMatches.filter((t) => !existingIds.has(t._id));
        return [...validTickets, ...newTickets].slice(0, limit);
      }

      return validTickets.slice(0, limit);
    } catch (error) {
      // Fallback to text search if embedding generation fails
      console.warn("Embedding generation failed, falling back to text search:", error);
      const allUserTickets = await ctx.runQuery(
        (internal as any).functions.tickets.queries.listByCreatorInternal,
        { userId: args.userId }
      );

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
        .slice(0, limit)
        .map((t) => ({ ...t!, _score: 0.5 }));

      return textMatches;
    }
  },
});

/**
 * Semantic search for vendor quotes
 * Optimized: Uses direct queries for simple requests, embeddings for semantic queries
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

    // If ticketId is provided, use direct query (more efficient)
    if (args.ticketId) {
      const quotes = await ctx.runQuery(
        (internal as any).functions.vendorQuotes.queries.getByTicketIdInternal,
        { ticketId: args.ticketId }
      );

      let filtered = quotes;
      if (args.status) {
        filtered = filtered.filter((q) => q.status === args.status);
      }

      return filtered.slice(0, limit).map((q) => ({ ...q, _score: 1.0 }));
    }

    // Check if this is a simple query
    if (isSimpleQuery(args.query) && args.status) {
      // Use direct query for simple status-based requests
      const allUserQuotes = await ctx.runQuery(
        (internal as any).functions.vendorQuotes.queries.getByUserIdInternal,
        {
          userId: args.userId,
          limit,
        }
      );

      const filtered = allUserQuotes.quotes.filter((q) => q.status === args.status);
      return filtered.map((q) => ({ ...q, _score: 1.0 }));
    }

    // For semantic queries, use embeddings
    try {
      const queryEmbedding = await generateQueryEmbedding(args.query);

      // Build filter
      let filter: ((q: any) => any) | undefined;
      if (args.status) {
        filter = (q: any) => q.eq("status", args.status);
      }

      // Search quotes using vector similarity
      const results = await ctx.vectorSearch("vendorQuotes", "by_embedding", {
        vector: queryEmbedding,
        limit: limit * 2, // Get more for filtering
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

      return quotes.slice(0, limit);
    } catch (error) {
      // Fallback to direct query if embedding fails
      console.warn("Embedding generation failed, falling back to direct query:", error);
      const allUserQuotes = await ctx.runQuery(
        (internal as any).functions.vendorQuotes.queries.getByUserIdInternal,
        {
          userId: args.userId,
          limit,
        }
      );

      return allUserQuotes.quotes.map((q) => ({ ...q, _score: 0.5 }));
    }
  },
});

/**
 * Semantic search for vendors
 * Optimized: Uses direct queries for simple requests, embeddings for semantic queries
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

    // If specialty is provided and query is simple, use direct query
    if (args.specialty && isSimpleQuery(args.query)) {
      // Would need a query by specialty - for now, use semantic search
      // This could be optimized further with a specialty index
    }

    // For semantic queries, use embeddings
    try {
      const queryEmbedding = await generateQueryEmbedding(args.query);

      // Build filter
      const filter = args.specialty
        ? (q: any) => q.eq("specialty", args.specialty)
        : undefined;

      // Search vendors using vector similarity
      const results = await ctx.vectorSearch("vendors", "by_embedding", {
        vector: queryEmbedding,
        limit: limit * 2, // Get more for filtering
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

      return vendors
        .filter((v): v is Doc<"vendors"> & { _score: number } => v !== null)
        .slice(0, limit);
    } catch (error) {
      // Fallback: return empty or use text search
      console.warn("Embedding generation failed:", error);
      return [];
    }
  },
});

