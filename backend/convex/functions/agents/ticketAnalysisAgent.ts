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

    // Get ALL photo URLs for analysis
    const imageUrls: string[] = [];
    if (ticket.photoIds && ticket.photoIds.length > 0) {
      for (const photoId of ticket.photoIds) {
        const url = await ctx.storage.getUrl(photoId);
        if (url) {
          imageUrls.push(url);
        }
      }
    }

    // Create tools
    const analyzeImage = createAnalyzeImageTool();
    const classifyIssue = createClassifyIssueTool();
    const updateTicket = createUpdateTicketTool(ctx, args.ticketId);

    // Create agent
    const agent = new Agent({
      model: openai("gpt-4o"),
      system: TICKET_ANALYSIS_SYSTEM_PROMPT,
      tools: {
        analyzeImage,
        classifyIssue,
        updateTicket,
      },
      stopWhen: stepCountIs(10), // Increased step count to allow analyzing multiple images
    });

    // Generate analysis
    const prompt = getTicketAnalysisPrompt({
      description: ticket.description,
      location: ticket.location,
      imageUrls, // Pass array of all image URLs
      urgency: ticket.urgency, // Pass user-provided urgency (if any)
    });

    const result = await agent.generate({ prompt });

    // After analysis completes, ensure status is set to "analyzed"
    // The agent should have already updated the status via updateTicket tool,
    // but we'll ensure it's set here as a safety measure
    await ctx.runMutation(
      (internal as any).functions.tickets.mutations.updateStatusInternal,
      {
        ticketId: args.ticketId,
        status: "analyzed",
      }
    );

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
      steps: result.steps.map((step: any) => {
        // Extract only serializable data from steps
        const toolCalls = step.content
          ?.filter((c: any) => c.type === "tool-call")
          .map((tc: any) => ({
            toolName: tc.toolName,
            input: tc.input,
          })) || [];
        
        const toolResults = step.content
          ?.filter((c: any) => c.type === "tool-result")
          .map((tr: any) => ({
            toolName: tr.toolName,
            output: tr.output,
          })) || [];

        return {
          toolCalls,
          toolResults,
        };
      }),
    };
  },
});

