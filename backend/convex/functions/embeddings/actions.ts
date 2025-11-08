/**
 * Embedding generation functions
 * Generate vector embeddings for similarity search
 */

"use node";

import { v } from "convex/values";
import OpenAI from "openai";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embedding for ticket
 */
export const generateTicketEmbedding = internalAction({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, args): Promise<Array<number>> => {
    const ticket: Doc<"tickets"> | null = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      {
        ticketId: args.ticketId,
      }
    );

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const embeddingText: string = [
      ticket.description,
      ticket.issueType,
      ...ticket.predictedTags,
      ticket.location,
    ]
      .filter(Boolean)
      .join(" ");

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: embeddingText,
    });

    const embedding: Array<number> = response.data[0].embedding;

    await ctx.runMutation(
      (internal as any).functions.embeddings.mutations.updateTicketEmbedding,
      {
        ticketId: args.ticketId,
        embedding,
      }
    );

    return embedding;
  },
});

/**
 * Generate embedding for vendor
 */
export const generateVendorEmbedding = internalAction({
  args: {
    vendorId: v.id("vendors"),
  },
  handler: async (ctx, args): Promise<Array<number>> => {
    const vendor: Doc<"vendors"> | null = await ctx.runQuery(
      (internal as any).functions.vendors.queries.getByIdInternal,
      {
        vendorId: args.vendorId,
      }
    );

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    const embeddingText: string = [
      vendor.businessName,
      vendor.specialty,
      vendor.address,
    ]
      .filter(Boolean)
      .join(" ");

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: embeddingText,
    });

    const embedding: Array<number> = response.data[0].embedding;

    await ctx.runMutation(
      (internal as any).functions.embeddings.mutations.updateVendorEmbedding,
      {
        vendorId: args.vendorId,
        embedding,
      }
    );

    return embedding;
  },
});

/**
 * Generate embedding for conversation
 */
export const generateConversationEmbedding = internalAction({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<Array<number>> => {
    const conversation: Doc<"conversations"> | null = await ctx.runQuery(
      (internal as any).functions.conversations.queries.getByIdInternal,
      {
        conversationId: args.conversationId,
      }
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const embeddingText: string = conversation.messages
      .map((msg: { message: string }) => msg.message)
      .join(" ");

    if (!embeddingText.trim()) {
      throw new Error("Conversation has no messages to embed");
    }

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: embeddingText,
    });

    const embedding: Array<number> = response.data[0].embedding;

    await ctx.runMutation(
      (internal as any).functions.embeddings.mutations.updateConversationEmbedding,
      {
        conversationId: args.conversationId,
        embedding,
      }
    );

    return embedding;
  },
});

/**
 * Generate embedding for vendor outreach
 */
export const generateVendorOutreachEmbedding = internalAction({
  args: {
    outreachId: v.id("vendorOutreach"),
  },
  handler: async (ctx, args): Promise<Array<number>> => {
    const outreach: Doc<"vendorOutreach"> | null = await ctx.runQuery(
      (internal as any).functions.vendorOutreach.queries.getByIdInternal,
      {
        outreachId: args.outreachId,
      }
    );

    if (!outreach) {
      throw new Error("Vendor outreach not found");
    }

    const ticket: Doc<"tickets"> | null = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      {
        ticketId: outreach.ticketId,
      }
    );

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const vendor: Doc<"vendors"> | null = await ctx.runQuery(
      (internal as any).functions.vendors.queries.getByIdInternal,
      {
        vendorId: outreach.vendorId,
      }
    );

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    const embeddingText: string = [
      ticket.description,
      ticket.issueType,
      ...ticket.predictedTags,
      ticket.location,
      vendor.businessName,
      vendor.specialty,
      vendor.address,
    ]
      .filter(Boolean)
      .join(" ");

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: embeddingText,
    });

    const embedding: Array<number> = response.data[0].embedding;

    await ctx.runMutation(
      (internal as any).functions.embeddings.mutations.updateVendorOutreachEmbedding,
      {
        outreachId: args.outreachId,
        embedding,
      }
    );

    return embedding;
  },
});

/**
 * Generate embedding for vendor quote
 */
export const generateVendorQuoteEmbedding = internalAction({
  args: {
    quoteId: v.id("vendorQuotes"),
  },
  handler: async (ctx, args): Promise<Array<number>> => {
    const quote: Doc<"vendorQuotes"> | null = await ctx.runQuery(
      (internal as any).functions.vendorQuotes.queries.getByIdInternal,
      {
        quoteId: args.quoteId,
      }
    );

    if (!quote) {
      throw new Error("Vendor quote not found");
    }

    const ticket: Doc<"tickets"> | null = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      {
        ticketId: quote.ticketId,
      }
    );

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const vendor: Doc<"vendors"> | null = await ctx.runQuery(
      (internal as any).functions.vendors.queries.getByIdInternal,
      {
        vendorId: quote.vendorId,
      }
    );

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    const priceFormatted: string =
      quote.currency === "USD" || quote.currency === "EUR" || quote.currency === "GBP"
        ? `${quote.price / 100} ${quote.currency}`
        : `${quote.price} ${quote.currency}`;
    const deliveryTimeFormatted = `${quote.estimatedDeliveryTime} hours`;
    const ratingText: string = quote.ratings ? `${quote.ratings}/5 rating` : "";

    const embeddingText: string = [
      ticket.description,
      ticket.issueType,
      ...ticket.predictedTags,
      vendor.businessName,
      vendor.specialty,
      `Price: ${priceFormatted}`,
      `Delivery time: ${deliveryTimeFormatted}`,
      ratingText,
      quote.responseText,
    ]
      .filter(Boolean)
      .join(" ");

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: embeddingText,
    });

    const embedding: Array<number> = response.data[0].embedding;

    await ctx.runMutation(
      (internal as any).functions.embeddings.mutations.updateVendorQuoteEmbedding,
      {
        quoteId: args.quoteId,
        embedding,
      }
    );

    return embedding;
  },
});

