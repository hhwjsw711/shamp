/**
 * Ticket queries - Public queries for ticket data access
 * All queries require userId and validate authorization
 */

import { query } from "../../_generated/server";
import { internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { validateUserId } from "../../utils/queryAuth";

/**
 * Get ticket by ID (public query with authorization)
 * Validates that the ticket belongs to the requesting user
 */
export const getById = query({
  args: { 
    ticketId: v.id("tickets"),
    userId: v.id("users"), // Required for authorization
  },
  handler: async (ctx, args) => {
    // Validate userId exists
    await validateUserId(ctx, args.userId);
    
    const ticket = await ctx.db.get(args.ticketId);
    
    if (!ticket) {
      return null;
    }
    
    // SECURITY: Ensure ticket belongs to the requesting user
    if (ticket.createdBy !== args.userId) {
      throw new Error("Unauthorized: Ticket does not belong to user");
    }

    // Get photo URLs for all photos
    const photoUrls: Array<string | null> = [];
    for (const photoId of ticket.photoIds) {
      const url = await ctx.storage.getUrl(photoId);
      photoUrls.push(url);
    }

    // Get verification photo URL if exists
    let verificationPhotoUrl: string | null = null;
    if (ticket.verificationPhotoId) {
      verificationPhotoUrl = await ctx.storage.getUrl(ticket.verificationPhotoId);
    }
    
    // Get before photo URLs
    const beforePhotoUrls: Array<string | null> = [];
    for (const photoId of ticket.beforePhotoIds || []) {
      const url = await ctx.storage.getUrl(photoId);
      beforePhotoUrls.push(url);
    }
    
    // Get after photo URLs
    const afterPhotoUrls: Array<string | null> = [];
    for (const photoId of ticket.afterPhotoIds || []) {
      const url = await ctx.storage.getUrl(photoId);
      afterPhotoUrls.push(url);
    }

    return {
      ...ticket,
      photoUrls,
      verificationPhotoUrl,
      beforePhotoUrls,
      afterPhotoUrls,
    };
  },
});

/**
 * List tickets by creator (public query with authorization)
 * SECURITY: Always filters by userId - users can only see their own tickets
 */
export const list = query({
  args: { 
    userId: v.id("users"), // Required - users can only query their own tickets
  },
  handler: async (ctx, args) => {
    // Validate userId exists in database
    await validateUserId(ctx, args.userId);
    
    // SECURITY: Always filter by userId using index
    // This ensures users can only access their own tickets
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .collect();
    
    // Sort by createdAt descending (most recent first)
    tickets.sort((a, b) => b.createdAt - a.createdAt);
    
    // Get photo URLs for each ticket
    const ticketsWithUrls = await Promise.all(
      tickets.map(async (ticket) => {
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

/**
 * List tickets by status (public query with authorization)
 * SECURITY: Filters by both userId and status
 */
export const listByStatus = query({
  args: { 
    userId: v.id("users"), // Required for authorization
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
  },
  handler: async (ctx, args) => {
    // Validate userId exists
    await validateUserId(ctx, args.userId);
    
    // SECURITY: Filter by userId first, then by status
    // This ensures users can only see their own tickets
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .filter((q) => q.eq(q.field("status"), args.status))
      .collect();
    
    // Sort by createdAt descending (most recent first)
    tickets.sort((a, b) => b.createdAt - a.createdAt);
    
    // Get photo URLs
    const ticketsWithUrls = await Promise.all(
      tickets.map(async (ticket) => {
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

/**
 * Search tickets by status with semantic search and sorting (public query)
 * SECURITY: Filters by userId and status - users can only see their own tickets
 * Note: For semantic search, use the searchByStatus action instead
 */
export const searchByStatus = query({
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
    query: v.optional(v.string()), // Text search query (not semantic - for simple filtering)
    sortBy: v.optional(v.union(v.literal("date"), v.literal("urgency"))), // Sort by date or urgency
  },
  handler: async (ctx, args) => {
    // Validate userId exists
    await validateUserId(ctx, args.userId);
    
    // Get tickets filtered by status
    let tickets = await ctx.db
      .query("tickets")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .filter((q) => q.eq(q.field("status"), args.status))
      .collect();
    
    // Apply text search filter if query provided (simple text matching, not semantic)
    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      tickets = tickets.filter((ticket) => {
        const searchText = [
          ticket.description,
          ticket.problemDescription,
          ticket.issueType,
          ticket.location,
          ...(ticket.predictedTags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchText.includes(queryLower);
      });
    }
    
    // Sort tickets
    if (args.sortBy === "urgency") {
      // Sort by urgency: emergency > urgent > normal > low > undefined
      const urgencyOrder: Record<string, number> = {
        emergency: 0,
        urgent: 1,
        normal: 2,
        low: 3,
      };
      tickets.sort((a, b) => {
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
      tickets.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    // Get photo URLs for each ticket
    const ticketsWithUrls = await Promise.all(
      tickets.map(async (ticket) => {
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

// ========== Internal Queries (for use by other backend functions) ==========

/**
 * Get ticket by ID (internal)
 * Used by mutations and actions that already have auth context
 */
export const getByIdInternal = internalQuery({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      return null;
    }

    // Get photo URLs for all photos
    const photoUrls: Array<string | null> = [];
    for (const photoId of ticket.photoIds) {
      const url = await ctx.storage.getUrl(photoId);
      photoUrls.push(url);
    }

    // Get verification photo URL if exists
    let verificationPhotoUrl: string | null = null;
    if (ticket.verificationPhotoId) {
      verificationPhotoUrl = await ctx.storage.getUrl(ticket.verificationPhotoId);
    }

    return {
      ...ticket,
      photoUrls,
      verificationPhotoUrl,
    };
  },
});

/**
 * List tickets by creator (internal)
 */
export const listByCreatorInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .collect();
    
    // Sort by createdAt descending (most recent first)
    tickets.sort((a, b) => b.createdAt - a.createdAt);
    
    return tickets;
  },
});

/**
 * List tickets by status (internal)
 */
export const listByStatusInternal = internalQuery({
  args: { 
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
  },
  handler: async (ctx, args) => {
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
    
    // Sort by createdAt descending (most recent first)
    tickets.sort((a, b) => b.createdAt - a.createdAt);
    
    return tickets;
  },
});

/**
 * List tickets by vendor (internal)
 */
export const listByVendorInternal = internalQuery({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args) => {
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_selectedVendorId", (q) => q.eq("selectedVendorId", args.vendorId))
      .collect();
    
    // Sort by createdAt descending (most recent first)
    tickets.sort((a, b) => b.createdAt - a.createdAt);
    
    return tickets;
  },
});
