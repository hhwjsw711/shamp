/**
 * Streaming Vendor Discovery Agent
 * Discovers vendors using database search or Firecrawl web search with streaming support
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

// Stream event types
type StreamEvent =
  | { type: "status"; message: string }
  | { type: "tool_call"; toolName: string; args: any }
  | { type: "tool_result"; toolName: string; result: any }
  | { type: "vendor_found"; vendor: VendorResult; index: number; total: number }
  | { type: "step"; stepNumber: number; description: string }
  | { type: "complete"; vendors: Array<VendorResult>; source: "database" | "web_search"; text: string }
  | { type: "error"; error: string };

/**
 * Streaming vendor discovery action
 * Returns an async generator that yields stream events
 */
export const discoverVendorsStream = action({
  args: {
    ticketId: v.id("tickets"),
    userId: v.id("users"),
  },
  handler: async function* (
    ctx,
    args
  ): AsyncGenerator<StreamEvent, void, unknown> {
    try {
      // Get ticket data using internal query
      yield { type: "status", message: "Loading ticket information..." };
      
      const ticket: Doc<"tickets"> | null = await ctx.runQuery(
        (internal as any).functions.tickets.queries.getByIdInternal,
        {
          ticketId: args.ticketId,
        }
      );

      if (!ticket) {
        yield { type: "error", error: "Ticket not found" };
        return;
      }

      // Verify user owns the ticket
      if (ticket.createdBy !== args.userId) {
        yield { type: "error", error: "Not authorized to discover vendors for this ticket" };
        return;
      }

      // Get user location
      yield { type: "status", message: "Getting user location..." };
      
      const userData: Doc<"users"> | null = await ctx.runQuery(
        (internal as any).functions.auth.queries.getUserByIdInternal,
        {
          userId: ticket.createdBy,
        }
      );

      if (!userData?.location) {
        yield { type: "error", error: "User location is required. Please update your profile with a location." };
        return;
      }

      const location: string = userData.location;

      // First, check if there are existing vendors in the database that match
      yield { type: "status", message: "Searching database for existing vendors..." };
      
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
        yield { type: "status", message: `Found ${existingVendors.length} existing vendor(s) in database` };
        
        const vendorResults: Array<VendorResult> = [];
        for (let index = 0; index < existingVendors.length; index++) {
          const vendor = existingVendors[index];
          const result = {
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
          };
          
          // Yield each vendor as it's processed
          yield { 
            type: "vendor_found", 
            vendor: result, 
            index: index + 1, 
            total: existingVendors.length 
          };
          
          vendorResults.push(result);
        }

        // Store results
        yield { type: "status", message: "Storing vendor results..." };
        
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
        yield { type: "status", message: "Sending outreach emails to vendors..." };
        
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

        yield {
          type: "complete",
          vendors: vendorResults,
          source: "database",
          text: `Found ${existingVendors.length} existing vendor(s) in database matching this ticket.`,
        };
        return;
      }

      // No existing vendors found, proceed with web search
      yield { type: "status", message: "No existing vendors found. Starting web search..." };
      
      const searchVendors = createSearchVendorsTool();
      const updateTicket = createUpdateTicketTool(ctx, args.ticketId);

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

      // Generate vendor discovery prompt
      const prompt = getVendorDiscoveryPrompt({
        issueType: ticket.issueType,
        tags: ticket.predictedTags,
        location,
        description: ticket.description,
        problemDescription: ticket.problemDescription,
      });

      yield { type: "status", message: "Searching the web for vendors..." };

      // Stream agent execution
      let stepNumber = 0;
      const allVendors: Array<VendorResult> = [];

      // Stream agent steps - agent.stream() returns an async iterable
      const streamResult = agent.stream({ prompt });
      // The stream result itself is async iterable
      for await (const step of streamResult as any) {
        stepNumber++;
        
        // Emit step event
        yield { 
          type: "step", 
          stepNumber, 
          description: `Processing step ${stepNumber}...` 
        };

        // Handle tool calls - check both content array and direct toolCalls property
        const toolCalls = step.toolCalls || 
          (step.content?.filter((c: any) => c.type === "tool-call") || []);
        
        if (toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            const toolName = toolCall.toolName || toolCall.name;
            const args = toolCall.args || toolCall.input;
            
            yield {
              type: "tool_call",
              toolName,
              args,
            };

            // Emit specific status messages based on tool
            if (toolName === "searchVendors") {
              yield { 
                type: "status", 
                message: `Searching for vendors in ${args?.location || location}...` 
              };
            }
          }
        }

        // Handle tool results - check both content array and direct toolResults property
        const toolResults = step.toolResults || 
          (step.content?.filter((c: any) => c.type === "tool-result") || []);
        
        if (toolResults.length > 0) {
          for (const toolResult of toolResults) {
            const toolName = toolResult.toolName || toolResult.name;
            const result = toolResult.result || toolResult.output;
            
            yield {
              type: "tool_result",
              toolName,
              result,
            };

            // Extract vendors from searchVendors tool results
            if (
              toolName === "searchVendors" &&
              result?.vendors
            ) {
              const vendors: Array<VendorResult> = result.vendors.map(
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

              // Yield each vendor as it's discovered
              for (let i = 0; i < vendors.length; i++) {
                const vendor = vendors[i];
                allVendors.push(vendor);
                yield {
                  type: "vendor_found",
                  vendor,
                  index: allVendors.length,
                  total: vendors.length, // This will be updated as more vendors are found
                };
              }

              yield { 
                type: "status", 
                message: `Found ${vendors.length} vendor(s). Extracting details...` 
              };
            }
          }
        }

        // Handle text output from agent
        if (step.text) {
          yield { type: "status", message: step.text };
        }
      }

      // Store firecrawl results
      if (allVendors.length > 0) {
        yield { type: "status", message: "Storing vendor results..." };
        
        const firecrawlResultsId: Id<"firecrawlResults"> = await ctx.runMutation(
          (api as any).functions.firecrawlResults.mutations.store,
          {
            ticketId: args.ticketId,
            results: allVendors,
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
      // COMMENTED OUT FOR TESTING - Extract individual URLs first
      // if (allVendors.length > 0) {
      //   yield { type: "status", message: "Sending outreach emails to vendors..." };
      //   
      //   try {
      //     await ctx.runAction(
      //       (api as any).functions.vendorOutreach.actions.sendOutreachEmails,
      //       {
      //         ticketId: args.ticketId,
      //         userId: args.userId,
      //       }
      //     );
      //   } catch (error) {
      //     console.error("Error sending outreach emails:", error);
      //   }
      // }

      yield {
        type: "complete",
        vendors: allVendors,
        source: "web_search",
        text: `Found ${allVendors.length} vendor(s) through web search.`,
      };
    } catch (error) {
      console.error("Vendor discovery stream error:", error);
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});

