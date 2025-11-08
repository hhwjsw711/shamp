/**
 * Vendor Outreach mutations and actions
 * Handle vendor outreach emails and status tracking
 */

import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

/**
 * Create a vendor outreach record when an email is sent to a vendor
 */
export const createInternal = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    vendorId: v.id("vendors"),
    emailId: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"vendorOutreach">> => {
    const now = Date.now();

    const outreachId = await ctx.db.insert("vendorOutreach", {
      ticketId: args.ticketId,
      vendorId: args.vendorId,
      emailId: args.emailId,
      emailSentAt: now,
      status: "sent",
      expiresAt: args.expiresAt,
    });

    return outreachId;
  },
});

/**
 * Update vendor outreach status
 */
export const updateStatus = internalMutation({
  args: {
    outreachId: v.id("vendorOutreach"),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("responded"),
      v.literal("bounced"),
      v.literal("expired")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.outreachId, {
      status: args.status,
    });
  },
});

