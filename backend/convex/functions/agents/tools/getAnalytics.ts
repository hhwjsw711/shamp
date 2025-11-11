/**
 * Tool for getting analytics/dashboard stats
 */

"use node";

import { z } from "zod";
import { tool } from "ai";
import { internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";

const getAnalyticsSchema = z.object({
  userId: z.string().describe("User ID to get analytics for"),
});

type GetAnalyticsParams = z.infer<typeof getAnalyticsSchema>;

export function createGetAnalyticsTool(ctx: ActionCtx) {
  return tool({
    description:
      "Get dashboard analytics and KPIs for a user. Returns ticket counts by status, quote statistics, average response times, and vendor performance metrics.",
    inputSchema: getAnalyticsSchema,
    execute: async ({ userId }: GetAnalyticsParams) => {
      const stats = await ctx.runQuery(
        (internal as any).functions.analytics.queries.getDashboardStatsInternal,
        { userId: userId as any }
      );

      return {
        ticketCountsByStatus: stats.ticketCountsByStatus,
        totalTickets: stats.totalTickets,
        newQuotesCount: stats.newQuotesCount,
        pendingQuotesCount: stats.pendingQuotesCount,
        selectedQuotesCount: stats.selectedQuotesCount,
        averageQuotePrice: stats.averageQuotePrice,
        averageDeliveryTime: stats.averageDeliveryTime,
        mostUsedVendor: stats.mostUsedVendor,
        averageResponseTime: stats.averageResponseTime,
        averageFixTime: stats.averageFixTime,
      };
    },
  } as any);
}

