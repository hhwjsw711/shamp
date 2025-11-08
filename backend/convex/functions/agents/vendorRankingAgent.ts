/**
 * Vendor Ranking Agent
 * Ranks vendors based on their quotes using scoring algorithm
 */

"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";

/**
 * Rank vendors based on their quotes
 */
export const rankVendors = action({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    rankedQuotes: Array<Doc<"vendorQuotes"> & { score: number }>;
  }> => {
    // Get all received quotes for this ticket
    const quotes: Array<Doc<"vendorQuotes">> = await ctx.runQuery(
      (internal as any).functions.vendorQuotes.queries.getByTicketIdInternal,
      {
        ticketId: args.ticketId,
      }
    );

    if (quotes.length === 0) {
      return { rankedQuotes: [] };
    }

    // Get ticket to understand urgency
    const ticket: Doc<"tickets"> | null = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      {
        ticketId: args.ticketId,
      }
    );

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Calculate scores for each quote
    const quotesWithScores: Array<Doc<"vendorQuotes"> & { score: number }> =
      await Promise.all(
        quotes.map(async (quote: Doc<"vendorQuotes">) => {
          // Get vendor and outreach info
          const vendor: Doc<"vendors"> | null = await ctx.runQuery(
            (internal as any).functions.vendors.queries.getByIdInternal,
            {
              vendorId: quote.vendorId,
            }
          );

          const outreach: Doc<"vendorOutreach"> | null = await ctx.runQuery(
            (internal as any).functions.vendorOutreach.queries.getByIdInternal,
            {
              outreachId: quote.vendorOutreachId,
            }
          );

          if (!vendor || !outreach) {
            return { ...quote, score: 0 };
          }

          // Calculate response time (hours between email sent and response received)
          let responseTimeHours = 0;
          let responseScore = 0;

          if (quote.responseReceivedAt) {
            responseTimeHours =
              (quote.responseReceivedAt - outreach.emailSentAt) /
              (1000 * 60 * 60);
            const maxResponseTime = 72;
            responseScore = Math.max(0, 1 - responseTimeHours / maxResponseTime);
          }

          // Normalize values for scoring
          const prices = quotes.map((q: Doc<"vendorQuotes">) => q.price);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const priceRange = maxPrice - minPrice || 1;
          const priceScore =
            priceRange > 0 ? 1 - (quote.price - minPrice) / priceRange : 0.5;

          const deliveryTimes = quotes.map(
            (q: Doc<"vendorQuotes">) => q.estimatedDeliveryTime
          );
          const minTime = Math.min(...deliveryTimes);
          const maxTime = Math.max(...deliveryTimes);
          const timeRange = maxTime - minTime || 1;
          const deliveryScore =
            timeRange > 0
              ? 1 - (quote.estimatedDeliveryTime - minTime) / timeRange
              : 0.5;

          const ratingScore = quote.ratings ? quote.ratings / 5 : 0.5;
          const vendorRatingScore = vendor.rating ? vendor.rating / 5 : 0.5;

          // Weighted scoring
          const totalScore =
            priceScore * 0.3 +
            deliveryScore * 0.25 +
            ratingScore * 0.2 +
            responseScore * 0.15 +
            vendorRatingScore * 0.1;

          return {
            ...quote,
            score: totalScore,
          };
        })
      );

    // Update scores in database
    for (const quoteWithScore of quotesWithScores) {
      await ctx.runMutation(
        (internal as any).functions.vendorQuotes.mutations.updateScore,
        {
          quoteId: quoteWithScore._id,
          score: quoteWithScore.score,
        }
      );
    }

    // Sort by score (highest first)
    quotesWithScores.sort(
      (
        a: Doc<"vendorQuotes"> & { score: number },
        b: Doc<"vendorQuotes"> & { score: number }
      ) => (b.score || 0) - (a.score || 0)
    );

    return {
      rankedQuotes: quotesWithScores,
    };
  },
});

