/**
 * Tool for querying tickets using semantic search
 */

"use node";

import { z } from "zod";
import { tool } from "ai";
import { api, internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import type { Doc } from "../../../_generated/dataModel";

const queryTicketsSchema = z.object({
  userId: z.string().describe("User ID to query tickets for"),
  query: z.string().describe("Natural language query describing what tickets to find (e.g., 'pending tickets about plumbing', 'tickets in the kitchen', 'broken equipment')"),
  status: z.string().optional().describe("Filter by ticket status (optional, can be inferred from query)"),
  location: z.string().optional().describe("Filter by location (optional, can be inferred from query)"),
  tag: z.string().optional().describe("Filter by tag (optional, can be inferred from query)"),
  limit: z.number().optional().describe("Maximum number of tickets to return (default: 10)"),
});

type QueryTicketsParams = z.infer<typeof queryTicketsSchema>;

export function createQueryTicketsTool(ctx: ActionCtx) {
  return tool({
    description:
      "Query tickets for a user using semantic search. Understands natural language queries to find relevant tickets. Returns ticket details including ID, description, status, location, issue type, and tags. Use this when the user asks about specific tickets, issues, or problems.",
    parameters: queryTicketsSchema,
    execute: async ({
      userId,
      query,
      status,
      location,
      tag,
      limit = 10,
    }: QueryTicketsParams) => {
      // Use semantic search to find relevant tickets
      const semanticResults = await ctx.runAction(
        (api as any).functions.embeddings.semanticSearch.searchTicketsSemantic,
        {
          userId: userId as any,
          query,
          limit: limit * 2, // Get more results for filtering
        }
      );

      let tickets = semanticResults;

      // Apply additional filters if provided
      if (status) {
        tickets = tickets.filter((t) => t.status === status);
      }

      if (location) {
        tickets = tickets.filter((t) => t.location === location);
      }

      if (tag) {
        tickets = tickets.filter((t) =>
          t.predictedTags?.includes(tag)
        );
      }

      // Apply final limit
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
          relevanceScore: t._score, // Include semantic similarity score
        })),
        count: tickets.length,
        query: query, // Return the query used for transparency
      };
    },
  } as any);
}

