/**
 * Firecrawl Results mutations
 * Store vendor discovery results from Firecrawl
 */

import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

const vendorResultSchema = v.object({
  businessName: v.string(),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  specialty: v.string(),
  address: v.string(),
  rating: v.optional(v.number()),
  vendorId: v.optional(v.id("vendors")), // Optional vendor ID if vendor exists in database
  url: v.optional(v.string()), // URL from web search
  description: v.optional(v.string()), // Description from search results
  position: v.optional(v.number()), // Search result position/ranking
  services: v.optional(v.array(v.string())), // Services offered by vendor
});

/**
 * Store firecrawl results (internal mutation)
 * Called by agents after vendor discovery
 */
export const store = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    results: v.array(vendorResultSchema),
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

/**
 * Append vendor to existing firecrawl results (internal mutation)
 * Used for incremental saving as vendors are extracted
 */
export const appendVendor = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    vendor: vendorResultSchema,
  },
  handler: async (ctx, args): Promise<Id<"firecrawlResults">> => {
    // Check if firecrawlResults already exists for this ticket
    const existing = await ctx.db
      .query("firecrawlResults")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .first();

    if (existing) {
      // Append vendor to existing results
      await ctx.db.patch(existing._id, {
        results: [...existing.results, args.vendor],
      });
      return existing._id;
    } else {
      // Create new firecrawlResults with single vendor
      const resultId = await ctx.db.insert("firecrawlResults", {
        ticketId: args.ticketId,
        results: [args.vendor],
        createdAt: Date.now(),
      });
      return resultId;
    }
  },
});

/**
 * Update firecrawlResults ID on ticket (internal mutation)
 * Called when first vendor is saved to link ticket to results
 */
export const linkToTicket = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    firecrawlResultsId: v.id("firecrawlResults"),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.ticketId, {
      firecrawlResultsId: args.firecrawlResultsId,
    });
  },
});

