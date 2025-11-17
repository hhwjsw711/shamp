/**
 * Discovery Logs queries
 * Fetch vendor discovery streaming events
 */

import { v } from "convex/values";
import { query } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

/**
 * Get discovery logs for a ticket
 * Returns logs ordered by sequence number (chronological order)
 */
export const getByTicketId = query({
  args: {
    ticketId: v.id("tickets"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user owns the ticket
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.createdBy !== args.userId) {
      throw new Error("Not authorized to view discovery logs for this ticket");
    }

    // Fetch logs ordered by sequence number
    const logs = await ctx.db
      .query("discoveryLogs")
      .withIndex("by_ticketId_sequence", (q) => q.eq("ticketId", args.ticketId))
      .order("asc")
      .collect();

    return {
      logs: logs.map((log) => ({
        _id: log._id,
        type: log.type,
        message: log.message,
        toolName: log.toolName,
        toolArgs: log.toolArgs,
        toolResult: log.toolResult,
        vendor: log.vendor,
        stepNumber: log.stepNumber,
        error: log.error,
        timestamp: log.timestamp,
        sequenceNumber: log.sequenceNumber,
      })),
    };
  },
});

