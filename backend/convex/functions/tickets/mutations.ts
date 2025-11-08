/**
 * Ticket mutations - Internal mutations for ticket data modification
 */

import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

/**
 * Create ticket (internal)
 * Used by handlers and actions that already have auth context
 */
export const createInternal = internalMutation({
  args: {
    createdBy: v.id("users"),
    name: v.optional(v.string()), // Ticket creator name (optional, can get from user if authenticated)
    description: v.string(),
    location: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
    issueType: v.optional(v.string()),
    predictedTags: v.optional(v.array(v.string())),
    status: v.optional(v.string()),
    // PIN submission fields
    submittedViaPin: v.optional(v.boolean()),
    pinOwnerId: v.optional(v.id("users")),
    submittedByEmail: v.optional(v.string()),
    submittedByPhone: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"tickets">> => {
    const ticketId = await ctx.db.insert("tickets", {
      createdBy: args.createdBy,
      name: args.name,
      description: args.description,
      location: args.location,
      photoId: args.photoId,
      issueType: args.issueType,
      predictedTags: args.predictedTags || [],
      status: args.status || "New",
      createdAt: Date.now(),
      submittedViaPin: args.submittedViaPin || false,
      pinOwnerId: args.pinOwnerId,
      submittedByEmail: args.submittedByEmail,
      submittedByPhone: args.submittedByPhone,
    });

    return ticketId;
  },
});

/**
 * Update ticket fields (internal)
 * Used by actions and handlers that already have auth context
 */
export const updateInternal = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    issueType: v.optional(v.string()),
    predictedTags: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    firecrawlResultsId: v.optional(v.id("firecrawlResults")),
    selectedVendorId: v.optional(v.id("vendors")),
    selectedVendorQuoteId: v.optional(v.id("vendorQuotes")),
    conversationId: v.optional(v.id("conversations")),
    scheduledDate: v.optional(v.number()),
    verificationPhotoId: v.optional(v.id("_storage")),
    closedAt: v.optional(v.number()),
    quoteStatus: v.optional(
      v.union(
        v.literal("awaiting_quotes"),
        v.literal("quotes_received"),
        v.literal("vendor_selected"),
        v.literal("scheduling")
      )
    ),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { ticketId, ...updates } = args;
    
    // Only update fields that are provided
    const fieldsToUpdate: Record<string, any> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fieldsToUpdate[key] = value;
      }
    });

    if (Object.keys(fieldsToUpdate).length > 0) {
      await ctx.db.patch(ticketId, fieldsToUpdate);
    }
  },
});

/**
 * Update ticket status (internal)
 */
export const updateStatusInternal = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ticketId, {
      status: args.status,
    });
  },
});

/**
 * Assign vendor to ticket (internal)
 */
export const assignVendorInternal = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    vendorId: v.id("vendors"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ticketId, {
      selectedVendorId: args.vendorId,
      status: "Awaiting Vendor",
    });
  },
});

/**
 * Close ticket (internal)
 */
export const closeTicketInternal = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    verificationPhotoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const updates: {
      status: string;
      closedAt: number;
      verificationPhotoId?: Id<"_storage">;
    } = {
      status: "Closed",
      closedAt: Date.now(),
    };

    if (args.verificationPhotoId) {
      updates.verificationPhotoId = args.verificationPhotoId;
    }

    await ctx.db.patch(args.ticketId, updates);
  },
});

/**
 * Schedule repair (internal)
 */
export const scheduleRepairInternal = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    scheduledDate: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ticketId, {
      scheduledDate: args.scheduledDate,
      status: "Scheduled",
    });
  },
});

