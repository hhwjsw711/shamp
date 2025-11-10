/**
 * Tool for querying vendor quotes
 */

"use node";

import { z } from "zod";
import { tool } from "ai";
import { internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import type { Doc } from "../../../_generated/dataModel";

const queryQuotesSchema = z.object({
  ticketId: z.string().optional().describe("Filter by ticket ID"),
  vendorId: z.string().optional().describe("Filter by vendor ID"),
  status: z.string().optional().describe("Filter by quote status"),
  limit: z.number().optional().describe("Maximum number of quotes to return"),
});

type QueryQuotesParams = z.infer<typeof queryQuotesSchema>;

export function createQueryQuotesTool(ctx: ActionCtx) {
  return tool({
    description:
      "Query vendor quotes. Can filter by ticket ID, vendor ID, or status. Returns quote details including price, currency, delivery time, ratings, and vendor information.",
    parameters: queryQuotesSchema,
    execute: async ({
      ticketId,
      vendorId,
      status,
      limit = 50,
    }: QueryQuotesParams) => {
      let quotes: Array<Doc<"vendorQuotes">>;

      if (ticketId) {
        quotes = await ctx.runQuery(
          (internal as any).functions.vendorQuotes.queries.getByTicketIdInternal,
          { ticketId: ticketId as any }
        );
        
        // Filter by vendor if provided
        if (vendorId) {
          quotes = quotes.filter((q) => q.vendorId === (vendorId as any));
        }
        
        // Filter by status if provided
        if (status) {
          quotes = quotes.filter((q) => q.status === status);
        }
      } else {
        // Get all quotes with filters
        const result = await ctx.runQuery(
          (internal as any).functions.vendorQuotes.queries.getAllInternal,
          {
            limit,
            status: status as any,
            vendorId: vendorId as any,
          }
        );
        quotes = result.quotes;
      }

      // Apply limit (for ticketId case, since getAllInternal already applies limit)
      if (ticketId) {
        quotes = quotes.slice(0, limit);
      }

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
          };
        })
      );

      return {
        quotes: quotesWithVendors,
        count: quotesWithVendors.length,
      };
    },
  } as any);
}

