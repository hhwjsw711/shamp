/**
 * Tool for querying vendors
 */

"use node";

import { z } from "zod";
import { tool } from "ai";
import { internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import type { Doc } from "../../../_generated/dataModel";

const queryVendorsSchema = z.object({
  specialty: z.string().optional().describe("Filter by vendor specialty"),
  ticketId: z.string().optional().describe("Get vendors for a specific ticket"),
  limit: z.number().optional().describe("Maximum number of vendors to return"),
});

type QueryVendorsParams = z.infer<typeof queryVendorsSchema>;

export function createQueryVendorsTool(ctx: ActionCtx) {
  return tool({
    description:
      "Query vendors. Can filter by specialty or get vendors for a specific ticket. Returns vendor details including business name, email, specialty, address, and rating.",
    parameters: queryVendorsSchema,
    execute: async ({
      specialty,
      ticketId,
      limit = 50,
    }: QueryVendorsParams) => {
      let vendors: Array<Doc<"vendors">>;

      if (ticketId) {
        // Get vendors associated with a ticket via quotes or outreach
        const quotes: Array<Doc<"vendorQuotes">> = await ctx.runQuery(
          (internal as any).functions.vendorQuotes.queries.getByTicketIdInternal,
          { ticketId: ticketId as any }
        );

        const vendorIds = [...new Set(quotes.map((q) => q.vendorId))];

        vendors = await Promise.all(
          vendorIds.map(async (vendorId) => {
            return await ctx.runQuery(
              (internal as any).functions.vendors.queries.getByIdInternal,
              { vendorId }
            );
          })
        );

        vendors = vendors.filter((v): v is Doc<"vendors"> => v !== null);
      } else {
        // Get all vendors (would need a list query, but for now we'll return empty)
        // In a real implementation, you'd have a listAllInternal query
        vendors = [];
      }

      // Filter by specialty if provided
      if (specialty) {
        vendors = vendors.filter((v) =>
          v.specialty.toLowerCase().includes(specialty.toLowerCase())
        );
      }

      // Apply limit
      vendors = vendors.slice(0, limit);

      return {
        vendors: vendors.map((v) => ({
          id: v._id,
          businessName: v.businessName,
          email: v.email,
          phone: v.phone,
          specialty: v.specialty,
          address: v.address,
          rating: v.rating,
          jobsCount: v.jobs.length,
        })),
        count: vendors.length,
      };
    },
  } as any);
}

