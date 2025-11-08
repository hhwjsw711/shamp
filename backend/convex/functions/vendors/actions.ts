/**
 * Vendor search action
 * Search for existing vendors using vector similarity
 */

"use node";

import OpenAI from "openai";
import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Search for existing vendors in the database that match the ticket
 */
export const searchExisting = internalAction({
  args: {
    ticketId: v.id("tickets"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<Doc<"vendors">>> => {
    const ticket: Doc<"tickets"> | null = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      {
        ticketId: args.ticketId,
      }
    );

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    let ticketEmbedding: Array<number> | undefined = ticket.embedding;
    if (!ticketEmbedding) {
      const embeddingText = [
        ticket.description,
        ticket.issueType,
        ...ticket.predictedTags,
      ]
        .filter(Boolean)
        .join(" ");

      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: embeddingText,
      });

      ticketEmbedding = response.data[0].embedding;

      await ctx.runMutation(
        (internal as any).functions.embeddings.mutations.updateTicketEmbedding,
        {
          ticketId: args.ticketId,
          embedding: ticketEmbedding,
        }
      );
    }

    const results: Array<{ _id: Id<"vendors">; _score: number }> =
      await ctx.vectorSearch("vendors", "by_embedding", {
        vector: ticketEmbedding,
        limit: args.limit ?? 10,
        filter: ticket.issueType
          ? (q) => q.eq("specialty", ticket.issueType as string)
          : undefined,
      });

    const vendors: Array<Doc<"vendors"> | null> = await Promise.all(
      results.map(
        async (result: { _id: Id<"vendors">; _score: number }) =>
          await ctx.runQuery((internal as any).functions.vendors.queries.getByIdInternal, {
            vendorId: result._id,
          })
      )
    );

    return vendors.filter(
      (vendor): vendor is Doc<"vendors"> =>
        vendor !== null && vendor.embedding !== undefined
    );
  },
});

