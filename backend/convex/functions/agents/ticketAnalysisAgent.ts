/**
 * Ticket Analysis Agent
 * Analyzes ticket images and descriptions to classify issues and generate tags
 */

"use node";

import { Experimental_Agent as Agent, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { v } from "convex/values";
import { action } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import {
  TICKET_ANALYSIS_SYSTEM_PROMPT,
  getTicketAnalysisPrompt,
} from "../../prompts/ticketAnalysis";
import { createAnalyzeImageTool } from "./tools/analyzeImage";
import { createClassifyIssueTool } from "./tools/classifyIssue";
import { createUpdateTicketTool } from "./tools/updateTicket";
import type { Doc } from "../../_generated/dataModel";

export const analyzeTicket = action({
  args: {
    ticketId: v.id("tickets"),
    userId: v.id("users"), // User ID passed from HTTP handler after auth
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    text: string;
    steps: Array<any>;
  }> => {
    // Get ticket data using internal query
    const ticket: Doc<"tickets"> | null = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      {
        ticketId: args.ticketId,
      }
    );

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Verify user owns the ticket
    if (ticket.createdBy !== args.userId) {
      throw new Error("Not authorized to analyze this ticket");
    }

    // Get first photo URL for analysis (use first photo if available)
    let imageUrl: string | null = null;
    if (ticket.photoIds && ticket.photoIds.length > 0) {
      imageUrl = await ctx.storage.getUrl(ticket.photoIds[0]);
    }

    // Create tools
    const analyzeImage = createAnalyzeImageTool(ctx);
    const classifyIssue = createClassifyIssueTool();
    const updateTicket = createUpdateTicketTool(ctx);

    // Create agent
    const agent = new Agent({
      model: openai("gpt-4o"),
      system: TICKET_ANALYSIS_SYSTEM_PROMPT,
      tools: {
        analyzeImage,
        classifyIssue,
        updateTicket,
      },
      stopWhen: stepCountIs(5),
    });

    // Generate analysis
    const prompt = getTicketAnalysisPrompt({
      description: ticket.description,
      location: ticket.location,
      imageUrl,
    });

    const result = await agent.generate({ prompt });

    // Trigger embedding generation after analysis
    await ctx.scheduler.runAfter(
      0,
      (internal as any).functions.embeddings.actions.generateTicketEmbedding,
      {
        ticketId: args.ticketId,
      }
    );

    return {
      text: result.text,
      steps: result.steps,
    };
  },
});

