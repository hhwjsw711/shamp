/**
 * Ticket queries - Internal queries for ticket data access
 */

import { internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

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

    // Get photo URL if photoId exists
    let photoUrl: string | null = null;
    if (ticket.photoId) {
      photoUrl = await ctx.storage.getUrl(ticket.photoId);
    }

    // Get verification photo URL if exists
    let verificationPhotoUrl: string | null = null;
    if (ticket.verificationPhotoId) {
      verificationPhotoUrl = await ctx.storage.getUrl(ticket.verificationPhotoId);
    }

    return {
      ...ticket,
      photoUrl,
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
    return await ctx.db
      .query("tickets")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .collect();
  },
});

/**
 * List tickets by status (internal)
 */
export const listByStatusInternal = internalQuery({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tickets")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

/**
 * List tickets by vendor (internal)
 */
export const listByVendorInternal = internalQuery({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tickets")
      .withIndex("by_selectedVendorId", (q) => q.eq("selectedVendorId", args.vendorId))
      .collect();
  },
});

