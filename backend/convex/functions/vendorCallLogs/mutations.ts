/**
 * Vendor Call Logs Mutations
 * Handle creating and updating vendor call logs
 */

import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

/**
 * Create a new vendor call log entry
 */
export const create = internalMutation({
  args: {
    vapiCallId: v.string(),
    ticketId: v.id("tickets"),
    vendorId: v.id("vendors"),
    vendorName: v.string(),
    phoneNumber: v.string(),
    originalEmail: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("ringing"),
      v.literal("in-progress"),
      v.literal("ended"),
      v.literal("failed"),
      v.literal("poll_error")
    ),
  },
  handler: async (ctx, args): Promise<Id<"vendorCallLogs">> => {
    const now = Date.now();
    return await ctx.db.insert("vendorCallLogs", {
      vapiCallId: args.vapiCallId,
      ticketId: args.ticketId,
      vendorId: args.vendorId,
      vendorName: args.vendorName,
      phoneNumber: args.phoneNumber,
      originalEmail: args.originalEmail,
      status: args.status,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update vendor call log with call results
 */
export const update = internalMutation({
  args: {
    vapiCallId: v.string(),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("ringing"),
        v.literal("in-progress"),
        v.literal("ended"),
        v.literal("failed"),
        v.literal("poll_error")
      )
    ),
    transcript: v.optional(v.string()),
    verifiedEmail: v.optional(v.string()),
    endedReason: v.optional(v.string()),
    recordingUrl: v.optional(v.string()),
    analysis: v.optional(v.any()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vendorCallLogs")
      .withIndex("by_vapiCallId", (q) => q.eq("vapiCallId", args.vapiCallId))
      .first();

    if (!existing) {
      throw new Error(`Call log not found for vapiCallId: ${args.vapiCallId}`);
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.status !== undefined) updates.status = args.status;
    if (args.transcript !== undefined) updates.transcript = args.transcript;
    if (args.verifiedEmail !== undefined)
      updates.verifiedEmail = args.verifiedEmail;
    if (args.endedReason !== undefined) updates.endedReason = args.endedReason;
    if (args.recordingUrl !== undefined) updates.recordingUrl = args.recordingUrl;
    if (args.analysis !== undefined) updates.analysis = args.analysis;
    if (args.metadata !== undefined) updates.metadata = args.metadata;

    await ctx.db.patch(existing._id, updates);
  },
});

/**
 * Update extracted email during call (from function call)
 */
export const updateExtractedEmail = internalMutation({
  args: {
    vapiCallId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vendorCallLogs")
      .withIndex("by_vapiCallId", (q) => q.eq("vapiCallId", args.vapiCallId))
      .first();

    if (!existing) {
      throw new Error(`Call log not found for vapiCallId: ${args.vapiCallId}`);
    }

    await ctx.db.patch(existing._id, {
      verifiedEmail: args.email,
      updatedAt: Date.now(),
    });
  },
});

