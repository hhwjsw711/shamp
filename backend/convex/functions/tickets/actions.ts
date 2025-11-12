/**
 * Ticket actions - For operations that require actions (like semantic search)
 */

"use node";

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";

/**
 * Search tickets by status with semantic search and sorting (action)
 * Uses semantic search for better relevance, then filters by status and sorts
 */
export const searchByStatusSemantic = action({
  args: {
    userId: v.id("users"),
    status: v.union(
      v.literal("analyzing"),
      v.literal("analyzed"),
      v.literal("processing"),
      v.literal("reviewed"),
      v.literal("quotes_available"),
      v.literal("scheduled"),
      v.literal("fixed"),
      v.literal("closed")
    ),
    query: v.string(), // Semantic search query
    sortBy: v.optional(v.union(v.literal("date"), v.literal("urgency"))),
  },
  handler: async (ctx, args) => {
    // Call semantic search action
    const searchResults = await ctx.runAction(
      (internal as any).functions.embeddings.semanticSearch.searchTicketsSemantic,
      {
        userId: args.userId,
        query: args.query,
        limit: 100, // Get enough results to filter and sort
      }
    );
    
    // Filter by status
    let tickets = searchResults.filter((t: any) => t.status === args.status);
    
    // Sort tickets
    if (args.sortBy === "urgency") {
      // Sort by urgency: emergency > urgent > normal > low > undefined
      const urgencyOrder: Record<string, number> = {
        emergency: 0,
        urgent: 1,
        normal: 2,
        low: 3,
      };
      tickets.sort((a: any, b: any) => {
        const aOrder = a.urgency ? urgencyOrder[a.urgency] ?? 4 : 4;
        const bOrder = b.urgency ? urgencyOrder[b.urgency] ?? 4 : 4;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        // If same urgency, sort by date descending
        return b.createdAt - a.createdAt;
      });
    } else {
      // Sort by date descending (most recent first)
      tickets.sort((a: any, b: any) => b.createdAt - a.createdAt);
    }
    
    // Get photo URLs for each ticket
    const ticketsWithUrls = await Promise.all(
      tickets.map(async (ticket: any) => {
        const photoUrls: Array<string | null> = [];
        for (const photoId of ticket.photoIds) {
          const url = await ctx.storage.getUrl(photoId);
          photoUrls.push(url);
        }
        
        return {
          ...ticket,
          photoUrls,
        };
      })
    );
    
    return ticketsWithUrls;
  },
});

