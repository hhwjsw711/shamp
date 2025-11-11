/**
 * Tool for querying vendors using semantic search
 */

"use node";

import { z } from "zod";
import { tool } from "ai";
import { api, internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import type { Doc } from "../../../_generated/dataModel";

const queryVendorsSchema = z.object({
  query: z.string().describe("Natural language query describing what vendors to find (e.g., 'plumbing contractors', 'HVAC specialists near me', 'electricians', 'vendors for kitchen repairs')"),
  specialty: z.string().optional().describe("Filter by vendor specialty (optional, can be inferred from query)"),
  ticketId: z.string().optional().describe("Get vendors for a specific ticket"),
  limit: z.number().optional().describe("Maximum number of vendors to return (default: 10)"),
});

type QueryVendorsParams = z.infer<typeof queryVendorsSchema>;

export function createQueryVendorsTool(ctx: ActionCtx) {
  return tool({
    description:
      "Query vendors using semantic search. Understands natural language queries to find relevant vendors. Returns vendor details including business name, email, specialty, address, and rating. Use this when the user asks about vendors, contractors, or service providers.",
    inputSchema: queryVendorsSchema,
    execute: async ({
      query,
      specialty,
      ticketId,
      limit = 10,
    }: QueryVendorsParams) => {
      let vendors: Array<Doc<"vendors"> & { _score: number }>;

      if (ticketId) {
        // Get vendors associated with a ticket via quotes or outreach
        const quotes: Array<Doc<"vendorQuotes">> = await ctx.runQuery(
          (internal as any).functions.vendorQuotes.queries.getByTicketIdInternal,
          { ticketId: ticketId as any }
        );

        const vendorIds = [...new Set(quotes.map((q) => q.vendorId))];

        const vendorDocs = await Promise.all(
          vendorIds.map(async (vendorId) => {
            return await ctx.runQuery(
              (internal as any).functions.vendors.queries.getByIdInternal,
              { vendorId }
            );
          })
        );

        vendors = vendorDocs
          .filter((v): v is Doc<"vendors"> => v !== null)
          .map((v) => ({ ...v, _score: 1.0 })); // No semantic score for ticket-based lookup
      } else {
        // Use semantic search to find relevant vendors
        vendors = await ctx.runAction(
          (api as any).functions.embeddings.semanticSearch.searchVendorsSemantic,
          {
            query,
            specialty,
            limit: limit * 2, // Get more results for filtering
          }
        );
      }

      // Apply final limit
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
          relevanceScore: v._score, // Include semantic similarity score
        })),
        count: vendors.length,
        query: query, // Return the query used for transparency
      };
    },
  } as any);
}

