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
    photoIds: v.array(v.id("_storage")), // Required array of photo IDs (max 5)
    issueType: v.optional(v.string()),
    predictedTags: v.optional(v.array(v.string())),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("analyzed"),
        v.literal("processing"),
        v.literal("vendors_available"),
        v.literal("vendor_selected"),
        v.literal("vendor_scheduled"),
        v.literal("fixed"),
        v.literal("closed")
      )
    ),
    // PIN submission fields
    submittedViaPin: v.optional(v.boolean()),
    pinOwnerId: v.optional(v.id("users")),
    submittedByEmail: v.optional(v.string()),
    submittedByPhone: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"tickets">> => {
    // Validate photoIds array length (max 5)
    if (args.photoIds.length === 0) {
      throw new Error("At least one photo is required");
    }
    if (args.photoIds.length > 5) {
      throw new Error("Maximum 5 photos allowed");
    }

    const ticketId = await ctx.db.insert("tickets", {
      createdBy: args.createdBy,
      name: args.name,
      description: args.description,
      location: args.location,
      photoIds: args.photoIds,
      beforePhotoIds: args.photoIds, // Set beforePhotoIds to initial photos
      issueType: args.issueType,
      predictedTags: args.predictedTags || [],
      status: args.status || "pending",
      vendorStatus: "not_started", // Initialize vendor status
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
    problemDescription: v.optional(v.string()), // Detailed problem description in simple terms
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    firecrawlResultsId: v.optional(v.id("firecrawlResults")),
    selectedVendorId: v.optional(v.id("vendors")),
    selectedVendorQuoteId: v.optional(v.id("vendorQuotes")),
    conversationId: v.optional(v.id("conversations")),
    scheduledDate: v.optional(v.number()),
    verificationPhotoId: v.optional(v.id("_storage")),
    closedAt: v.optional(v.number()),
    // Urgency/Priority
    urgency: v.optional(
      v.union(
        v.literal("emergency"),
        v.literal("urgent"),
        v.literal("normal"),
        v.literal("low")
      )
    ),
    // Real-Time Vendor Status
    vendorStatus: v.optional(
      v.union(
        v.literal("not_started"),
        v.literal("arrived"),
        v.literal("in_progress"),
        v.literal("completed")
      )
    ),
    vendorArrivedAt: v.optional(v.number()),
    vendorStartedAt: v.optional(v.number()),
    vendorCompletedAt: v.optional(v.number()),
    // Before/After Photos
    beforePhotoIds: v.optional(v.array(v.id("_storage"))),
    afterPhotoIds: v.optional(v.array(v.id("_storage"))),
    // Guest Impact Tracking
    affectedRooms: v.optional(v.array(v.string())),
    guestsAffected: v.optional(v.number()),
    guestsNotified: v.optional(v.boolean()),
    guestNotificationMethod: v.optional(
      v.union(
        v.literal("email"),
        v.literal("sms"),
        v.literal("phone"),
        v.literal("in_person"),
        v.literal("none")
      )
    ),
    guestNotificationSentAt: v.optional(v.number()),
    quoteStatus: v.optional(
      v.union(
        v.literal("awaiting_quotes"),
        v.literal("quotes_received"),
        v.literal("vendor_selected"),
        v.literal("scheduling")
      )
    ),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("analyzed"),
        v.literal("processing"),
        v.literal("vendors_available"),
        v.literal("vendor_selected"),
        v.literal("vendor_scheduled"),
        v.literal("fixed"),
        v.literal("closed")
      )
    ),
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
      status: "vendor_selected",
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
      status: "closed";
      closedAt: number;
      verificationPhotoId?: Id<"_storage">;
    } = {
      status: "closed",
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
      status: "vendor_scheduled",
    });
  },
});

/**
 * Delete ticket (internal)
 * Deletes ticket and associated files from storage
 */
export const deleteTicketInternal = internalMutation({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, args) => {
    // Get ticket to access file IDs
    const ticket = await ctx.db.get(args.ticketId);
    
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Delete associated photos from storage
    for (const photoId of ticket.photoIds) {
      try {
        await ctx.storage.delete(photoId);
      } catch (error) {
        // Log error but don't fail ticket deletion if file deletion fails
        console.error(`Failed to delete photo ${photoId}:`, error);
      }
    }

    if (ticket.verificationPhotoId) {
      try {
        await ctx.storage.delete(ticket.verificationPhotoId);
      } catch (error) {
        // Log error but don't fail ticket deletion if file deletion fails
        console.error(`Failed to delete verification photo ${ticket.verificationPhotoId}:`, error);
      }
    }

    // Delete ticket from database
    await ctx.db.delete(args.ticketId);
  },
});

/**
 * Delete photo from ticket (internal)
 * Removes a single photo from ticket's photoIds array
 */
export const deletePhotoFromTicketInternal = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    photoId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Get ticket
    const ticket = await ctx.db.get(args.ticketId);
    
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Check if photo exists in ticket
    if (!ticket.photoIds.includes(args.photoId)) {
      throw new Error("Photo not found in ticket");
    }

    // Ensure at least one photo remains
    if (ticket.photoIds.length <= 1) {
      throw new Error("Cannot delete the last photo. At least one photo is required.");
    }

    // Remove photo from array
    const updatedPhotoIds = ticket.photoIds.filter((id) => id !== args.photoId);

    // Update ticket
    await ctx.db.patch(args.ticketId, {
      photoIds: updatedPhotoIds,
    });

    // Delete file from storage
    try {
      await ctx.storage.delete(args.photoId);
    } catch (error) {
      // Log error but don't fail if file deletion fails
      console.error(`Failed to delete photo ${args.photoId} from storage:`, error);
    }
  },
});

