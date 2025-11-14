/**
 * Email Draft Agent
 * Drafts professional emails to vendors requesting quotes
 */

"use node";

import { Experimental_Agent as Agent, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";
import {
  EMAIL_DRAFT_SYSTEM_PROMPT,
  getEmailDraftPrompt,
} from "../../prompts/emailDraft";
import { createDraftEmailTool } from "./tools/draftEmail";
import { createUpdateTicketTool } from "./tools/updateTicket";
import type { Doc } from "../../_generated/dataModel";

export const draftVendorEmail = action({
  args: {
    ticketId: v.id("tickets"),
    vendorId: v.id("vendors"),
    userId: v.id("users"), // User ID passed from HTTP handler after auth
    orgName: v.optional(v.string()), // Organization name for email personalization
    photoUrls: v.optional(v.array(v.string())), // All photo URLs for email attachments
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    subject: string;
    body: string;
    agentText: string;
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
      throw new Error("Not authorized to draft email for this ticket");
    }

    // Get vendor data using internal query
    const vendor: Doc<"vendors"> | null = await ctx.runQuery(
      (internal as any).functions.vendors.queries.getByIdInternal,
      {
        vendorId: args.vendorId,
      }
    );

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    // Get photo URLs for email draft (use provided URLs or fetch from ticket)
    let imageUrls: string[] = [];
    if (args.photoUrls && args.photoUrls.length > 0) {
      // Use provided photo URLs
      imageUrls = args.photoUrls;
    } else if (ticket.photoIds && ticket.photoIds.length > 0) {
      // Fetch all photo URLs from ticket
      for (const photoId of ticket.photoIds) {
        const url = await ctx.storage.getUrl(photoId);
        if (url) {
          imageUrls.push(url);
        }
      }
    }
    
    // For backward compatibility with draftEmail tool, use first image URL
    const imageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

    // Get user data for orgName if not provided (must be done before creating tools)
    let orgName = args.orgName;
    if (!orgName) {
      const userData = await ctx.runQuery(
        (internal as any).functions.auth.queries.getUserByIdInternal,
        { userId: ticket.createdBy }
      );
      orgName = userData?.orgName || null;
    }

    // Create tools (pass orgName to draftEmail tool)
    const draftEmail = createDraftEmailTool(orgName);
    const updateTicket = createUpdateTicketTool(ctx, args.ticketId);

    // Create agent
    const agent = new Agent({
      model: openai("gpt-4o"),
      system: EMAIL_DRAFT_SYSTEM_PROMPT,
      tools: {
        draftEmail,
        updateTicket,
      },
      stopWhen: stepCountIs(3),
    });

    // Generate email draft
    const prompt = getEmailDraftPrompt({
      description: ticket.description,
      issueType: ticket.issueType,
      location: ticket.location,
      tags: ticket.predictedTags,
      imageUrl,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      vendorBusinessName: vendor.businessName,
      vendorEmail: vendor.email,
      orgName,
    });

    const result = await agent.generate({ prompt });

    // Extract email from agent's tool calls
    const emailContent = extractEmailFromSteps(result.steps);

    return {
      ...emailContent,
      agentText: result.text,
    };
  },
});

function extractEmailFromSteps(steps: Array<any>): {
  subject: string;
  body: string;
} {
  for (const step of steps) {
    if (step.toolResults) {
      for (const toolResult of step.toolResults) {
        if (toolResult.toolName === "draftEmail" && toolResult.result) {
          return {
            subject: toolResult.result.subject || "",
            body: toolResult.result.body || "",
          };
        }
      }
    }
  }
  return { subject: "", body: "" };
}

