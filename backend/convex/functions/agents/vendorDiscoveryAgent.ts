/**
 * Vendor Discovery Agent
 * Discovers vendors using database search or Firecrawl web search
 */

"use node";

import { Experimental_Agent as Agent, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { v } from "convex/values";
import { action } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import {
  VENDOR_DISCOVERY_SYSTEM_PROMPT,
  getVendorDiscoveryPrompt,
} from "../../prompts/vendorDiscovery";
import { createSearchVendorsTool } from "./tools/searchVendors";
import { createUpdateTicketTool } from "./tools/updateTicket";
import type { Doc, Id } from "../../_generated/dataModel";

// Shared vendor result type for consistent shape across database and web search results
type VendorResult = {
  businessName: string;
  email?: string;
  phone?: string;
  specialty: string;
  address: string;
  rating?: number;
  vendorId?: string; // Only present for existing database vendors
  url?: string; // Only present for web search results
  description?: string;
  position?: number;
  services?: Array<string>;
};

export const discoverVendors = action({
  args: {
    ticketId: v.id("tickets"),
    userId: v.id("users"), // User ID passed from HTTP handler after auth
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    vendors: Array<VendorResult>;
    source: "database" | "web_search";
    text: string;
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
      throw new Error("Not authorized to discover vendors for this ticket");
    }

    // Get user location - prioritize user's location from users table
    const userData: Doc<"users"> | null = await ctx.runQuery(
      (internal as any).functions.auth.queries.getUserByIdInternal,
      {
        userId: ticket.createdBy,
      }
    );

    if (!userData?.location) {
      throw new Error(
        "User location is required. Please update your profile with a location."
      );
    }

    const location: string = userData.location;

    // First, check if there are existing vendors in the database that match
    let existingVendors: Array<Doc<"vendors">> = [];
    try {
      existingVendors = await ctx.runAction(
        (internal as any).functions.vendors.actions.searchExisting,
        {
          ticketId: args.ticketId,
          limit: 5,
        }
      );
    } catch (error) {
      console.error(
        `Error searching existing vendors for ticket ${args.ticketId}:`,
        error
      );
      existingVendors = [];
    }

    // If we found existing vendors, return them without searching
    if (existingVendors.length > 0) {
      const vendorResults: Array<VendorResult> = existingVendors.map(
        (vendor: Doc<"vendors">) => ({
          businessName: vendor.businessName,
          email: vendor.email,
          phone: vendor.phone,
          specialty: vendor.specialty,
          address: vendor.address,
          rating: vendor.rating,
          vendorId: vendor._id,
          url: undefined,
          description: undefined,
          position: undefined,
          services: undefined,
        })
      );

      // Store results
      const firecrawlResultsId: Id<"firecrawlResults"> = await ctx.runMutation(
        (api as any).functions.firecrawlResults.mutations.store,
        {
          ticketId: args.ticketId,
          results: vendorResults,
        }
      );

      await ctx.runMutation(
        (internal as any).functions.tickets.mutations.updateInternal,
        {
          ticketId: args.ticketId,
          firecrawlResultsId,
        }
      );

      // Automatically send outreach emails to discovered vendors
      try {
        await ctx.runAction(
          (api as any).functions.vendorOutreach.actions.sendOutreachEmails,
          {
            ticketId: args.ticketId,
            userId: args.userId,
          }
        );
      } catch (error) {
        console.error("Error sending outreach emails:", error);
      }

      return {
        vendors: vendorResults,
        source: "database",
        text: `Found ${existingVendors.length} existing vendor(s) in database matching this ticket.`,
      };
    }

    // No existing vendors found, proceed with web search
    const searchVendors = createSearchVendorsTool();
    const updateTicket = createUpdateTicketTool(ctx);

    // Create agent
    const agent = new Agent({
      model: openai("gpt-4o"),
      system: VENDOR_DISCOVERY_SYSTEM_PROMPT,
      tools: {
        searchVendors,
        updateTicket,
      },
      stopWhen: stepCountIs(10),
    });

    // Generate vendor discovery
    const prompt = getVendorDiscoveryPrompt({
      issueType: ticket.issueType,
      tags: ticket.predictedTags,
      location,
    });

    const result = await agent.generate({ prompt });

    // Store firecrawl results
    const vendorResults: Array<VendorResult> = extractVendorsFromSteps(
      result.steps
    );

    if (vendorResults.length > 0) {
      const firecrawlResultsId: Id<"firecrawlResults"> = await ctx.runMutation(
        (api as any).functions.firecrawlResults.mutations.store,
        {
          ticketId: args.ticketId,
          results: vendorResults,
        }
      );

      await ctx.runMutation(
        (internal as any).functions.tickets.mutations.updateInternal,
        {
          ticketId: args.ticketId,
          firecrawlResultsId,
        }
      );
    }

    // Automatically send outreach emails to discovered vendors
    try {
      await ctx.runAction(
        (api as any).functions.vendorOutreach.actions.sendOutreachEmails,
        {
          ticketId: args.ticketId,
          userId: args.userId,
        }
      );
    } catch (error) {
      console.error("Error sending outreach emails:", error);
    }

    return {
      vendors: vendorResults,
      source: "web_search",
      text: result.text,
    };
  },
});

function extractVendorsFromSteps(steps: Array<any>): Array<VendorResult> {
  const vendors: Array<VendorResult> = [];
  for (const step of steps) {
    if (step.toolResults) {
      for (const toolResult of step.toolResults) {
        if (
          toolResult.toolName === "searchVendors" &&
          toolResult.result?.vendors
        ) {
          const webVendors: Array<VendorResult> = toolResult.result.vendors.map(
            (vendor: any) => ({
              businessName: vendor.businessName || "Unknown",
              email: vendor.email,
              phone: vendor.phone,
              specialty: vendor.specialty || "General",
              address: vendor.address || "",
              rating: vendor.rating,
              url: vendor.url,
              description: vendor.description,
              position: vendor.position,
              services: vendor.services,
              vendorId: undefined,
            })
          );
          vendors.push(...webVendors);
        }
      }
    }
  }
  return vendors;
}

