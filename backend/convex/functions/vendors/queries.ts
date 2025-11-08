/**
 * Vendor queries - Internal queries for vendor data access
 */

import { internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

/**
 * Get vendor by ID (internal)
 */
export const getByIdInternal = internalQuery({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.vendorId);
  },
});

/**
 * Get vendor by email (internal)
 */
export const getByEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vendors")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

/**
 * List all vendors (internal)
 */
export const listInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("vendors").collect();
  },
});

