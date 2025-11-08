/**
 * Firecrawl Results mutations
 * Store vendor discovery results from Firecrawl
 */

import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

/**
 * Store firecrawl results (internal mutation)
 * Called by agents after vendor discovery
 */
export const store = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    results: v.array(
      v.object({
        businessName: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        specialty: v.string(),
        address: v.string(),
        rating: v.optional(v.number()),
        vendorId: v.optional(v.id("vendors")), // Optional vendor ID if vendor exists in database
        url: v.optional(v.string()), // URL from web search
        description: v.optional(v.string()),
        position: v.optional(v.number()),
        services: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args): Promise<Id<"firecrawlResults">> => {
    const resultId = await ctx.db.insert("firecrawlResults", {
      ticketId: args.ticketId,
      results: args.results,
      createdAt: Date.now(),
    });

    return resultId;
  },
});

