/**
 * Vendor Discovery Action
 * Discovers vendors using database search or Firecrawl web search
 * Runs independently without HTTP connection - logs are saved to database
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

/**
 * Vendor discovery action that runs independently
 * Saves logs to database as it processes - no HTTP connection required
 */
export const discoverVendors = action({
  args: {
    ticketId: v.id("tickets"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    let sequenceNumber = 0;
    let isComplete = false;
    
    // Set up timeout handler to catch action timeouts (fires 10 seconds before Convex timeout)
    const timeoutId = setTimeout(async () => {
      if (!isComplete) {
        // Action is about to timeout - save error log
        try {
          const timeoutSequenceNumber = Date.now(); // Use timestamp as sequence number for timeout log
          await ctx.runMutation(
            (internal as any).functions.discoveryLogs.mutations.addEntry,
            {
              ticketId: args.ticketId,
              type: "error",
              error: "Vendor discovery timed out after 600 seconds. The process may have completed partially.",
              timestamp: Date.now(),
              sequenceNumber: timeoutSequenceNumber,
            }
          );
        } catch (logError) {
          console.error("Error saving timeout log:", logError);
        }
      }
    }, 590000); // 590 seconds (10 seconds before 600s timeout)

    const saveLog = async (event: {
      type: "status" | "tool_call" | "tool_result" | "vendor_found" | "step" | "complete" | "error";
      message?: string;
      toolName?: string;
      toolArgs?: any;
      toolResult?: any;
      vendor?: any;
      stepNumber?: number;
      error?: string;
    }) => {
      try {
        sequenceNumber++;
        await ctx.runMutation(
          (internal as any).functions.discoveryLogs.mutations.addEntry,
          {
            ticketId: args.ticketId,
            type: event.type,
            message: event.message,
            toolName: event.toolName,
            toolArgs: event.toolArgs,
            toolResult: event.toolResult,
            vendor: event.vendor,
            stepNumber: event.stepNumber,
            error: event.error,
            timestamp: Date.now(),
            sequenceNumber,
          }
        );
      } catch (dbError) {
        console.error("Error saving discovery log entry:", dbError);
      }
    };

    try {
      // Clear existing logs for this ticket before starting new discovery
      try {
        await ctx.runMutation(
          (internal as any).functions.discoveryLogs.mutations.clearForTicket,
          { ticketId: args.ticketId }
        );
      } catch (clearError) {
        console.error("Error clearing existing logs:", clearError);
        // Continue anyway
      }

      await saveLog({ type: "status", message: "Starting vendor discovery..." });

      // Update ticket status to "find_vendors" immediately when vendor discovery starts
      try {
        await ctx.runMutation(
          (internal as any).functions.tickets.mutations.updateInternal,
          {
            ticketId: args.ticketId,
            status: "find_vendors",
          }
        );
      } catch (statusError) {
        console.error("Error updating ticket status:", statusError);
        // Continue anyway
      }

      // Get ticket data
      await saveLog({ type: "status", message: "Loading ticket information..." });
      
      const ticket = await ctx.runQuery(
        (internal as any).functions.tickets.queries.getByIdInternal,
        { ticketId: args.ticketId }
      );

      if (!ticket) {
        await saveLog({ type: "error", error: "Ticket not found" });
        isComplete = true;
        clearTimeout(timeoutId);
        return { success: false, message: "Ticket not found" };
      }

      if (ticket.createdBy !== args.userId) {
        await saveLog({ type: "error", error: "Not authorized" });
        isComplete = true;
        clearTimeout(timeoutId);
        return { success: false, message: "Not authorized" };
      }

      // Get user location
      await saveLog({ type: "status", message: "Getting user location..." });
      
      const userData = await ctx.runQuery(
        (api as any).functions.auth.queries.getUserByIdInternal,
        { userId: ticket.createdBy as any }
      );

      if (!userData?.location) {
        await saveLog({ 
          type: "error", 
          error: "User location is required. Please update your profile with a location." 
        });
        isComplete = true;
        clearTimeout(timeoutId);
        return { success: false, message: "User location is required" };
      }

      const location: string = userData.location;

      // Search database first
      await saveLog({ type: "status", message: "Searching database for existing vendors..." });
      
      let existingVendors: Array<any> = [];
      try {
        existingVendors = await ctx.runAction(
          (api as any).functions.vendors.actions.searchExisting,
          { ticketId: args.ticketId, limit: 5 }
        );
      } catch (error) {
        console.error("Error searching existing vendors:", error);
        existingVendors = [];
      }

      // If found in database, save them
      if (existingVendors.length > 0) {
        await saveLog({ 
          type: "status", 
          message: `Found ${existingVendors.length} existing vendor(s) in database` 
        });

        const vendorResults = existingVendors.map((vendor: any) => {
          return {
            businessName: vendor.businessName,
            email: vendor.email,
            phone: vendor.phone,
            specialty: vendor.specialty,
            address: vendor.address,
            rating: vendor.rating,
            vendorId: vendor._id,
          };
        });

        // Send vendor_found events for each vendor
        for (let i = 0; i < vendorResults.length; i++) {
          await saveLog({
            type: "vendor_found",
            vendor: vendorResults[i],
            stepNumber: i + 1,
          });
        }

        // Store results
        await saveLog({ type: "status", message: "Storing vendor results..." });
        
        const firecrawlResultsId = await ctx.runMutation(
          (api as any).functions.firecrawlResults.mutations.store,
          { ticketId: args.ticketId, results: vendorResults }
        );

        await ctx.runMutation(
          (internal as any).functions.tickets.mutations.updateInternal,
          { ticketId: args.ticketId, firecrawlResultsId }
        );

        // Send outreach emails
        // COMMENTED OUT FOR TESTING - Extract individual URLs first
        // NOTE: When uncommented, this will send initial emails to vendors and update ticket status to "requested_for_information"
        // await saveLog({ type: "status", message: "Sending outreach emails..." });
        // 
        // try {
        //   await ctx.runAction(
        //     (api as any).functions.vendorOutreach.actions.sendOutreachEmails,
        //     { ticketId: args.ticketId, userId: args.userId }
        //   );
        // } catch (error) {
        //   console.error("Error sending outreach emails:", error);
        // }

        await saveLog({
          type: "complete",
          message: `Found ${existingVendors.length} existing vendor(s) in database matching this ticket.`,
        });

        isComplete = true;
        clearTimeout(timeoutId);
        
        return { 
          success: true, 
          message: `Found ${existingVendors.length} existing vendor(s) in database` 
        };
      }

      // No database vendors found, proceed with web search using agent
      await saveLog({ type: "status", message: "No existing vendors found. Starting web search..." });

      // Track firecrawlResultsId for linking ticket
      let firecrawlResultsId: Id<"firecrawlResults"> | undefined;
      
      // Create searchVendors tool with callback to save vendors incrementally
      const searchVendors = createSearchVendorsTool({
        onVendorExtracted: async (vendor: any) => {
          // Save vendor incrementally to database
          try {
            const resultId = await ctx.runMutation(
              (internal as any).functions.firecrawlResults.mutations.appendVendor,
              { ticketId: args.ticketId, vendor }
            );
            
            // Link ticket to firecrawlResults on first vendor save
            if (!firecrawlResultsId) {
              firecrawlResultsId = resultId;
              await ctx.runMutation(
                (internal as any).functions.firecrawlResults.mutations.linkToTicket,
                { ticketId: args.ticketId, firecrawlResultsId: resultId }
              );
            }
            
            // Save log for this vendor
            await saveLog({
              type: "vendor_found",
              vendor,
            });
            
            allVendors.push(vendor);
          } catch (saveError) {
            console.error(`Error saving vendor ${vendor.businessName} incrementally:`, saveError);
            // Continue extraction even if save fails
          }
        },
      });
      const updateTicket = createUpdateTicketTool(ctx, args.ticketId);

      // Create agent
      const agent = new Agent({
        model: openai("gpt-4o"),
        system: VENDOR_DISCOVERY_SYSTEM_PROMPT,
        tools: { searchVendors, updateTicket },
        stopWhen: stepCountIs(10),
      });

      const prompt = getVendorDiscoveryPrompt({
        issueType: ticket.issueType,
        tags: ticket.predictedTags,
        location,
        description: ticket.description,
        problemDescription: ticket.problemDescription,
      });

      await saveLog({ type: "status", message: "Searching the web for vendors..." });

      // Stream agent execution
      let stepNumber = 0;
      const allVendors: Array<any> = [];

      // Stream agent steps - agent.stream() returns an object with textStream and fullStream properties
      const streamResult = agent.stream({ prompt });
      const fullStream = streamResult.fullStream;
      
      // Iterate over the full stream to capture all agent steps
      try {
        for await (const step of fullStream) {
          // Handle different step types based on TextStreamPart structure
          if (step.type === 'start-step') {
            stepNumber++;
            await saveLog({ 
              type: "step", 
              stepNumber, 
              message: `Processing step ${stepNumber}...` 
            });
          } else if (step.type === 'tool-call') {
            const toolName = step.toolName;
            const args = step.input;
            
            await saveLog({
              type: "tool_call",
              toolName,
              toolArgs: args,
            });

            if (toolName === "searchVendors") {
              await saveLog({ 
                type: "status", 
                message: `Searching for vendors in ${(args as any)?.location || location}...` 
              });
            }
          } else if (step.type === 'tool-result') {
            const toolName = step.toolName;
            const result = step.output;
            
            await saveLog({
              type: "tool_result",
              toolName,
              toolResult: result,
            });

            // Extract vendors from searchVendors tool results
            // Note: Vendors are already saved incrementally via the callback,
            // but we still need to process the final result for consistency
            if (
              toolName === "searchVendors" &&
              result &&
              typeof result === 'object' &&
              'vendors' in result &&
              Array.isArray((result as any).vendors)
            ) {
              const vendors = (result as any).vendors.map((vendor: any) => ({
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
              }));

              // Vendors are already saved incrementally via callback during extraction
              // Just ensure all vendors are in allVendors array (some may have been added via callback)
              for (const vendor of vendors) {
                if (!allVendors.find(v => v.url === vendor.url && v.businessName === vendor.businessName)) {
                  allVendors.push(vendor);
                }
              }

              await saveLog({ 
                type: "status", 
                message: `Found ${vendors.length} vendor(s). All vendors saved to database.` 
              });
            }
          } else if (step.type === 'text-delta') {
            // Text deltas are accumulated by the SDK, we can optionally send status updates
            // For now, we'll skip individual text deltas to avoid spam
          }
        }
      } catch (iterationError) {
        // Handle stream iteration errors
        console.error('Error iterating agent stream:', iterationError);
        await saveLog({ 
          type: "error", 
          error: `Stream iteration error: ${iterationError instanceof Error ? iterationError.message : String(iterationError)}` 
        });
        return { 
          success: false, 
          message: `Error: ${iterationError instanceof Error ? iterationError.message : "Unknown error"}` 
        };
      }

      // Results are already saved incrementally above, but ensure ticket is linked
      if (allVendors.length > 0) {
        await saveLog({ type: "status", message: `Saved ${allVendors.length} vendor(s) to database` });
        
        // Ensure ticket has firecrawlResultsId linked
        const existingResults = await ctx.runQuery(
          (internal as any).functions.firecrawlResults.queries.getByTicketIdInternal,
          { ticketId: args.ticketId }
        );
        
        if (existingResults && !ticket.firecrawlResultsId) {
          await ctx.runMutation(
            (internal as any).functions.tickets.mutations.updateInternal,
            { ticketId: args.ticketId, firecrawlResultsId: existingResults._id }
          );
        }
      }

      // Send outreach emails
      // COMMENTED OUT FOR TESTING - Extract individual URLs first
      // NOTE: When uncommented, this will send initial emails to vendors and update ticket status to "requested_for_information"
      // if (allVendors.length > 0) {
      //   await saveLog({ type: "status", message: "Sending outreach emails..." });
      //   
      //   try {
      //     await ctx.runAction(
      //       (api as any).functions.vendorOutreach.actions.sendOutreachEmails,
      //       { ticketId: args.ticketId, userId: args.userId }
      //     );
      //   } catch (error) {
      //     console.error("Error sending outreach emails:", error);
      //   }
      // }

      await saveLog({
        type: "complete",
        message: `Found ${allVendors.length} vendor(s) through web search.`,
      });

      isComplete = true;
      clearTimeout(timeoutId);
      
      return { 
        success: true, 
        message: `Found ${allVendors.length} vendor(s) through web search` 
      };
    } catch (error) {
      console.error("Vendor discovery error:", error);
      
      // Check if error is due to timeout
      const isTimeout = error instanceof Error && 
        (error.message.includes("timeout") || error.message.includes("timed out") || error.message.includes("600"));
      
      await saveLog({
        type: "error",
        error: isTimeout 
          ? "Vendor discovery timed out after 600 seconds. The process may have completed partially."
          : (error instanceof Error ? error.message : "Unknown error occurred"),
      });
      
      isComplete = true;
      clearTimeout(timeoutId);
      
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown error occurred" 
      };
    }
  },
});

