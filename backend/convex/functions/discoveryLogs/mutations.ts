/**
 * Discovery Logs mutations
 * Store vendor discovery streaming events
 */

import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

/**
 * Add a discovery log entry (internal mutation)
 * Called by streaming handler as events are generated
 */
export const addEntry = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    type: v.union(
      v.literal("status"),
      v.literal("tool_call"),
      v.literal("tool_result"),
      v.literal("vendor_found"),
      v.literal("step"),
      v.literal("complete"),
      v.literal("error")
    ),
    message: v.optional(v.string()),
    toolName: v.optional(v.string()),
    toolArgs: v.optional(v.any()),
    toolResult: v.optional(v.any()),
    vendor: v.optional(
      v.object({
        businessName: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        specialty: v.string(),
        address: v.string(),
        rating: v.optional(v.number()),
        vendorId: v.optional(v.id("vendors")),
        url: v.optional(v.string()),
        description: v.optional(v.string()),
        position: v.optional(v.number()),
        services: v.optional(v.array(v.string())),
      })
    ),
    stepNumber: v.optional(v.number()),
    error: v.optional(v.string()),
    timestamp: v.number(),
    sequenceNumber: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"discoveryLogs">> => {
    const logId = await ctx.db.insert("discoveryLogs", {
      ticketId: args.ticketId,
      type: args.type,
      message: args.message,
      toolName: args.toolName,
      toolArgs: args.toolArgs,
      toolResult: args.toolResult,
      vendor: args.vendor,
      stepNumber: args.stepNumber,
      error: args.error,
      timestamp: args.timestamp,
      sequenceNumber: args.sequenceNumber,
    });

    return logId;
  },
});

/**
 * Clear discovery logs for a ticket (internal mutation)
 * Called when starting a new discovery process
 */
export const clearForTicket = internalMutation({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, args) => {
    const existingLogs = await ctx.db
      .query("discoveryLogs")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .collect();

    // Delete all existing logs for this ticket
    for (const log of existingLogs) {
      await ctx.db.delete(log._id);
    }
  },
});

