/**
 * User Chat Agent
 * Handles user queries about tickets, quotes, vendors, and analytics
 */

"use node";

import { Experimental_Agent as Agent, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { v } from "convex/values";
import { action } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import {
  USER_CHAT_SYSTEM_PROMPT,
  getUserChatPrompt,
} from "../../prompts/userChat";
import { createQueryTicketsTool } from "./tools/queryTickets";
import { createQueryQuotesTool } from "./tools/queryQuotes";
import { createQueryVendorsTool } from "./tools/queryVendors";
import { createGetAnalyticsTool } from "./tools/getAnalytics";
import { createDraftResponseTool } from "./tools/draftResponse";
import type { Doc } from "../../_generated/dataModel";

export const chatWithUser = action({
  args: {
    userId: v.id("users"),
    message: v.string(),
    conversationHistory: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      )
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    text: string;
    steps: Array<any>;
  }> => {
    // Verify user exists
    const user: Doc<"users"> | null = await ctx.runQuery(
      (internal as any).functions.auth.queries.getUserByIdInternal,
      {
        userId: args.userId,
      }
    );

    if (!user) {
      throw new Error("User not found");
    }

    // Create tools
    const queryTickets = createQueryTicketsTool(ctx);
    const queryQuotes = createQueryQuotesTool(ctx);
    const queryVendors = createQueryVendorsTool(ctx);
    const getAnalytics = createGetAnalyticsTool(ctx);
    const draftResponse = createDraftResponseTool(ctx);

    // Create agent
    const agent = new Agent({
      model: openai("gpt-4o"),
      system: USER_CHAT_SYSTEM_PROMPT,
      tools: {
        queryTickets,
        queryQuotes,
        queryVendors,
        getAnalytics,
        draftResponse,
      },
      stopWhen: stepCountIs(15), // Allow multiple tool calls for complex queries
    });

    // Build conversation history string
    const conversationHistoryString = args.conversationHistory
      ? args.conversationHistory
          .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
          .join("\n\n")
      : undefined;

    // Generate response
    const prompt = getUserChatPrompt({
      userMessage: args.message,
      userId: args.userId,
      conversationHistory: conversationHistoryString,
    });

    const result = await agent.generate({ prompt });

    return {
      text: result.text,
      steps: result.steps,
    };
  },
});

