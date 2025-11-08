/**
 * Vendor mutations - Internal mutations for vendor data modification
 */

import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

/**
 * Create vendor (internal)
 */
export const createInternal = internalMutation({
  args: {
    businessName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    specialty: v.string(),
    address: v.string(),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"vendors">> => {
    const vendorId = await ctx.db.insert("vendors", {
      businessName: args.businessName,
      email: args.email,
      phone: args.phone,
      specialty: args.specialty,
      address: args.address,
      rating: args.rating,
      jobs: [],
    });

    return vendorId;
  },
});

/**
 * Update vendor (internal)
 */
export const updateInternal = internalMutation({
  args: {
    vendorId: v.id("vendors"),
    businessName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    specialty: v.optional(v.string()),
    address: v.optional(v.string()),
    rating: v.optional(v.number()),
    emailStatus: v.optional(
      v.union(
        v.literal("valid"),
        v.literal("invalid"),
        v.literal("bounced"),
        v.literal("complained"),
        v.literal("doNotEmail")
      )
    ),
    lastEmailError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { vendorId, ...updates } = args;

    const fieldsToUpdate: Record<string, any> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fieldsToUpdate[key] = value;
      }
    });

    if (Object.keys(fieldsToUpdate).length > 0) {
      await ctx.db.patch(vendorId, fieldsToUpdate);
    }
  },
});

/**
 * Add job to vendor (internal)
 */
export const addJobInternal = internalMutation({
  args: {
    vendorId: v.id("vendors"),
    ticketId: v.id("tickets"),
    assignedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) {
      throw new Error("Vendor not found");
    }

    const newJob = {
      ticketId: args.ticketId,
      assignedAt: args.assignedAt,
    };

    await ctx.db.patch(args.vendorId, {
      jobs: [...vendor.jobs, newJob],
    });
  },
});

/**
 * Update vendor rating (internal)
 */
export const updateRatingInternal = internalMutation({
  args: {
    vendorId: v.id("vendors"),
    rating: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.vendorId, {
      rating: args.rating,
    });
  },
});

