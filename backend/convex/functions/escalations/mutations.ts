/**
 * Escalation mutations and queries
 */

import { internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";

/**
 * Create an escalation (internal)
 */
export const createInternal = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    vendorId: v.id("vendors"),
    vendorOutreachId: v.id("vendorOutreach"),
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    vendorMessage: v.string(),
    vendorEmail: v.string(),
    intent: v.union(
      v.literal("question"),
      v.literal("clarification"),
      v.literal("quote_provided"),
      v.literal("declining"),
      v.literal("follow_up"),
      v.literal("complex"),
      v.literal("other")
    ),
    confidenceScore: v.number(),
    reason: v.string(),
    agentSuggestedResponse: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"escalations">> => {
    const escalationId = await ctx.db.insert("escalations", {
      ticketId: args.ticketId,
      vendorId: args.vendorId,
      vendorOutreachId: args.vendorOutreachId,
      conversationId: args.conversationId,
      userId: args.userId,
      vendorMessage: args.vendorMessage,
      vendorEmail: args.vendorEmail,
      intent: args.intent,
      confidenceScore: args.confidenceScore,
      reason: args.reason,
      status: "pending",
      agentSuggestedResponse: args.agentSuggestedResponse,
      createdAt: Date.now(),
    });

    return escalationId;
  },
});

/**
 * Update escalation status (internal)
 */
export const updateStatusInternal = internalMutation({
  args: {
    escalationId: v.id("escalations"),
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed"),
      v.literal("responded"),
      v.literal("resolved")
    ),
    userResponse: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updateData: any = {
      status: args.status,
    };

    if (args.userResponse) {
      updateData.userResponse = args.userResponse;
    }

    if (args.status === "resolved") {
      updateData.resolvedAt = Date.now();
    }

    await ctx.db.patch(args.escalationId, updateData);
  },
});

/**
 * Get escalation by ID (internal)
 */
export const getByIdInternal = internalQuery({
  args: { escalationId: v.id("escalations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.escalationId);
  },
});

/**
 * List escalations by user (internal)
 */
export const listByUserInternal = internalQuery({
  args: {
    userId: v.id("users"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("reviewed"),
        v.literal("responded"),
        v.literal("resolved")
      )
    ),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("escalations")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId));

    const escalations = await query.collect();

    if (args.status) {
      return escalations.filter((e) => e.status === args.status);
    }

    return escalations;
  },
});

/**
 * List escalations by ticket (internal)
 */
export const listByTicketInternal = internalQuery({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("escalations")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .collect();
  },
});

