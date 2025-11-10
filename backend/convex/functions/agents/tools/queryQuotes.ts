/**
 * Tool for querying vendor quotes using semantic search
 */

"use node";

import { z } from "zod";
import { tool } from "ai";
import { api, internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import type { Doc } from "../../../_generated/dataModel";

const queryQuotesSchema = z.object({
  userId: z.string().describe("User ID to query quotes for"),
  query: z.string().describe("Natural language query describing what quotes to find (e.g., 'cheapest quotes', 'quotes for plumbing ticket', 'fastest delivery times', 'quotes under $500')"),
  ticketId: z.string().optional().describe("Filter by ticket ID"),
  vendorId: z.string().optional().describe("Filter by vendor ID"),
  status: z.string().optional().describe("Filter by quote status"),
  limit: z.number().optional().describe("Maximum number of quotes to return (default: 10)"),
});

type QueryQuotesParams = z.infer<typeof queryQuotesSchema>;

export function createQueryQuotesTool(ctx: ActionCtx) {
  return tool({
    description:
      "Query vendor quotes using semantic search. Understands natural language queries to find relevant quotes. Returns quote details including price, currency, delivery time, ratings, and vendor information. Use this when the user asks about quotes, pricing, vendors, or comparisons.",
    parameters: queryQuotesSchema,
    execute: async ({
      userId,
      query,
      ticketId,
      vendorId,
      status,
      limit = 10,
    }: QueryQuotesParams) => {
      // Use semantic search to find relevant quotes
      const semanticResults = await ctx.runAction(
        (api as any).functions.embeddings.semanticSearch.searchQuotesSemantic,
        {
          userId: userId as any,
          query,
          ticketId: ticketId as any,
          status: status as any,
          limit: limit * 2, // Get more results for filtering
        }
      );

      let quotes = semanticResults;

      // Apply additional filters if provided
      if (vendorId) {
        quotes = quotes.filter((q) => q.vendorId === (vendorId as any));
      }

      // Apply final limit
      quotes = quotes.slice(0, limit);

      // Get vendor details for each quote
      const quotesWithVendors = await Promise.all(
        quotes.map(async (quote) => {
          const vendor: Doc<"vendors"> | null = await ctx.runQuery(
            (internal as any).functions.vendors.queries.getByIdInternal,
            { vendorId: quote.vendorId }
          );

          return {
            id: quote._id,
            ticketId: quote.ticketId,
            vendorId: quote.vendorId,
            vendorName: vendor?.businessName || "Unknown",
            vendorEmail: vendor?.email,
            vendorPhone: vendor?.phone,
            vendorSpecialty: vendor?.specialty,
            vendorAddress: vendor?.address,
            vendorRating: vendor?.rating,
            price: quote.price,
            currency: quote.currency,
            estimatedDeliveryTime: quote.estimatedDeliveryTime,
            ratings: quote.ratings,
            status: quote.status,
            score: quote.score,
            responseText: quote.responseText,
            quoteDocumentId: quote.quoteDocumentId,
            quoteDocumentType: quote.quoteDocumentType,
            responseReceivedAt: quote.responseReceivedAt,
            createdAt: quote.createdAt,
            vendorOutreachId: quote.vendorOutreachId,
            relevanceScore: quote._score, // Include semantic similarity score
          };
        })
      );

      return {
        quotes: quotesWithVendors,
        count: quotesWithVendors.length,
        query: query, // Return the query used for transparency
      };
    },
  } as any);
}

