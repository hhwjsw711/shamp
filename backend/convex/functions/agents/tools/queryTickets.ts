/**
 * Tool for querying tickets
 */

"use node";

import { z } from "zod";
import { tool } from "ai";
import { internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import type { Doc } from "../../../_generated/dataModel";

const queryTicketsSchema = z.object({
  userId: z.string().describe("User ID to query tickets for"),
  status: z.string().optional().describe("Filter by ticket status"),
  location: z.string().optional().describe("Filter by location"),
  tag: z.string().optional().describe("Filter by tag"),
  limit: z.number().optional().describe("Maximum number of tickets to return"),
});

type QueryTicketsParams = z.infer<typeof queryTicketsSchema>;

export function createQueryTicketsTool(ctx: ActionCtx) {
  return tool({
    description:
      "Query tickets for a user. Can filter by status, location, or tag. Returns ticket details including ID, description, status, location, issue type, and tags.",
    parameters: queryTicketsSchema,
    execute: async ({
      userId,
      status,
      location,
      tag,
      limit = 50,
    }: QueryTicketsParams) => {
      let tickets: Array<Doc<"tickets">>;

      if (status) {
        tickets = await ctx.runQuery(
          (internal as any).functions.tickets.queries.listByStatusInternal,
          { status }
        );
      } else {
        tickets = await ctx.runQuery(
          (internal as any).functions.tickets.queries.listByCreatorInternal,
          { userId: userId as any }
        );
      }

      // Filter by location if provided
      if (location) {
        tickets = tickets.filter((t) => t.location === location);
      }

      // Filter by tag if provided
      if (tag) {
        tickets = tickets.filter((t) =>
          t.predictedTags?.includes(tag)
        );
      }

      // Filter to user's tickets
      tickets = tickets.filter((t) => t.createdBy === (userId as any));

      // Apply limit
      tickets = tickets.slice(0, limit);

      return {
        tickets: tickets.map((t) => ({
          id: t._id,
          description: t.description,
          problemDescription: t.problemDescription,
          status: t.status,
          location: t.location,
          issueType: t.issueType,
          tags: t.predictedTags,
          createdAt: t.createdAt,
          selectedVendorId: t.selectedVendorId,
        })),
        count: tickets.length,
      };
    },
  } as any);
}

