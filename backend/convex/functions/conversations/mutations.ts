/**
 * Conversation mutations - Internal mutations for conversation data modification
 */

import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

/**
 * Create conversation (internal)
 */
export const createInternal = internalMutation({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, args): Promise<Id<"conversations">> => {
    const conversationId = await ctx.db.insert("conversations", {
      ticketId: args.ticketId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return conversationId;
  },
});

/**
 * Add message to conversation (internal)
 */
export const addMessageInternal = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    sender: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("vendor")
    ),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const newMessage = {
      sender: args.sender,
      message: args.message,
      date: Date.now(),
    };

    await ctx.db.patch(args.conversationId, {
      messages: [...conversation.messages, newMessage],
      updatedAt: Date.now(),
    });
  },
});

