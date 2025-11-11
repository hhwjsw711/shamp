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
      v.literal("pending"),
      v.literal("analyzed"),
      v.literal("processing"),
      v.literal("vendors_available"),
      v.literal("vendor_selected"),
      v.literal("vendor_scheduled"),
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
 * List tickets by urgency (public query with authorization)
 * SECURITY: Filters by both userId and urgency
 */
export const listByUrgency = query({
  args: { 
    userId: v.id("users"), // Required for authorization
    urgency: v.union(
      v.literal("emergency"),
      v.literal("urgent"),
      v.literal("normal"),
      v.literal("low")
    ),
  },
  handler: async (ctx, args) => {
    // Validate userId exists
    await validateUserId(ctx, args.userId);
    
    // SECURITY: Filter by userId first, then by urgency
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .filter((q) => q.eq(q.field("urgency"), args.urgency))
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
      v.literal("pending"),
      v.literal("analyzed"),
      v.literal("processing"),
      v.literal("vendors_available"),
      v.literal("vendor_selected"),
      v.literal("vendor_scheduled"),
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
