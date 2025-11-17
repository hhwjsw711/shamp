/**
 * Agent HTTP handlers
 * Handle agent action endpoints
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { getErrorMessage } from "../../utils/errors";
import { authenticateUser } from "../../utils/httpAuth";
import { Experimental_Agent as Agent, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  VENDOR_DISCOVERY_SYSTEM_PROMPT,
  getVendorDiscoveryPrompt,
} from "../../prompts/vendorDiscovery";
import { createSearchVendorsTool } from "../../functions/agents/tools/searchVendors";
import { createUpdateTicketTool } from "../../functions/agents/tools/updateTicket";

/**
 * Analyze ticket handler
 * POST /api/agents/analyze-ticket
 */
export const analyzeTicketHandler = httpAction(async (ctx, request) => {
  try {
    const user = await authenticateUser(ctx, request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const body = await request.json();
    const { ticketId } = body;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const result = await ctx.runAction(
      (api as any).functions.agents.ticketAnalysisAgent.analyzeTicket,
      {
        ticketId: ticketId as any,
        userId: user.userId as any,
      }
    );

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Analyze ticket error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

/**
 * Discover vendors handler (non-streaming)
 * POST /api/agents/discover-vendors
 */
export const discoverVendorsHandler = httpAction(async (ctx, request) => {
  try {
    const user = await authenticateUser(ctx, request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const body = await request.json();
    const { ticketId } = body;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    try {
      const result = await ctx.runAction(
        (api as any).functions.agents.vendorDiscoveryAgent.discoverVendors,
        {
          ticketId: ticketId as any,
          userId: user.userId as any,
        }
      );

      return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      // Check if error is due to timeout
      const isTimeout = error instanceof Error && 
        (error.message.includes("timeout") || error.message.includes("timed out") || error.message.includes("600"));
      
      if (isTimeout) {
        // Check if vendors were found before timeout
        try {
          const ticket = await ctx.runQuery(
            (internal as any).functions.tickets.queries.getByIdInternal,
            { ticketId: ticketId as any }
          );
          
          if (ticket?.firecrawlResultsId) {
            const firecrawlResults = await ctx.runQuery(
              (internal as any).functions.firecrawlResults.queries.getByIdInternal,
              { resultId: ticket.firecrawlResultsId }
            );
            
            const vendorsFound = firecrawlResults?.results?.length || 0;
            
            // If vendors were found, treat timeout as success (no error toast)
            if (vendorsFound > 0) {
              return new Response(
                JSON.stringify({ 
                  success: true, 
                  message: `Found ${vendorsFound} vendor(s). Process timed out but results were saved.` 
                }),
                {
                  status: 200,
                  headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                  },
                }
              );
            }
          }
        } catch (checkError) {
          console.error("Error checking vendors on timeout:", checkError);
        }
      }
      
      // If timeout but no vendors found, or other error, return error response
      console.error("Discover vendors error:", error);
      return new Response(
        JSON.stringify({ error: getErrorMessage(error) }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  } catch (error) {
    console.error("Discover vendors error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

/**
 * Discover vendors handler (streaming)
 * POST /api/agents/discover-vendors/stream
 * Returns Server-Sent Events (SSE) stream
 * 
 * This handler delegates to the Convex action discoverVendorsStream
 * and converts its async generator output to SSE format for the frontend.
 */
export const discoverVendorsStreamHandler = httpAction(async (ctx, request) => {
  try {
    const user = await authenticateUser(ctx, request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const body = await request.json();
    const { ticketId } = body;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Get origin for CORS
    const origin = request.headers.get("origin");
    const allowedOrigin = origin || "*";

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let sequenceNumber = 0;

        const sendEvent = async (event: any) => {
          try {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));

            // Save event to database for persistence
            try {
              sequenceNumber++;
              await ctx.runMutation(
                (internal as any).functions.discoveryLogs.mutations.addEntry,
                {
                  ticketId: ticketId as any,
                  type: event.type,
                  message: event.message,
                  toolName: event.toolName,
                  toolArgs: event.args,
                  toolResult: event.result,
                  vendor: event.vendor,
                  stepNumber: event.stepNumber,
                  error: event.error,
                  timestamp: Date.now(),
                  sequenceNumber,
                }
              );
            } catch (dbError) {
              // Log but don't fail the stream if DB save fails
              console.error("Error saving discovery log entry:", dbError);
            }
          } catch (error) {
            console.error("Error sending event:", error);
          }
        };

        try {
          // Clear existing logs for this ticket before starting new discovery
          try {
            await ctx.runMutation(
              (internal as any).functions.discoveryLogs.mutations.clearForTicket,
              { ticketId: ticketId as any }
            );
          } catch (clearError) {
            console.error("Error clearing existing logs:", clearError);
            // Continue anyway
          }

          await sendEvent({ type: "status", message: "Starting vendor discovery..." });

          // Update ticket status to "find_vendors" immediately when vendor discovery starts
          try {
            await ctx.runMutation(
              (internal as any).functions.tickets.mutations.updateInternal,
              {
                ticketId: ticketId as any,
                status: "find_vendors",
              }
            );
          } catch (statusError) {
            console.error("Error updating ticket status:", statusError);
            // Continue anyway
          }

          // Get ticket data
          await sendEvent({ type: "status", message: "Loading ticket information..." });
          
          const ticket = await ctx.runQuery(
            (internal as any).functions.tickets.queries.getByIdInternal,
            { ticketId: ticketId as any }
          );

          if (!ticket) {
            await sendEvent({ type: "error", error: "Ticket not found" });
            controller.close();
            return;
          }

          if (ticket.createdBy !== user.userId) {
            await sendEvent({ type: "error", error: "Not authorized" });
            controller.close();
            return;
          }

          // Get user location
          await sendEvent({ type: "status", message: "Getting user location..." });
          
          const userData = await ctx.runQuery(
            (api as any).functions.auth.queries.getUserByIdInternal,
            { userId: ticket.createdBy as any }
          );

          if (!userData?.location) {
            await sendEvent({ 
              type: "error", 
              error: "User location is required. Please update your profile with a location." 
            });
            controller.close();
            return;
          }

          const location: string = userData.location;

          // Search database first
          await sendEvent({ type: "status", message: "Searching database for existing vendors..." });
          
          let existingVendors: Array<any> = [];
          try {
            existingVendors = await ctx.runAction(
              (api as any).functions.vendors.actions.searchExisting,
              { ticketId: ticketId as any, limit: 5 }
            );
          } catch (error) {
            console.error("Error searching existing vendors:", error);
            existingVendors = [];
          }

          // If found in database, stream them
          if (existingVendors.length > 0) {
            await sendEvent({ 
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
              await sendEvent({
                type: "vendor_found",
                vendor: vendorResults[i],
                index: i + 1,
                total: existingVendors.length,
              });
            }

            // Store results
            await sendEvent({ type: "status", message: "Storing vendor results..." });
            
            const firecrawlResultsId = await ctx.runMutation(
              (api as any).functions.firecrawlResults.mutations.store,
              { ticketId: ticketId as any, results: vendorResults }
            );

            await ctx.runMutation(
              (internal as any).functions.tickets.mutations.updateInternal,
              { ticketId: ticketId as any, firecrawlResultsId }
            );

            // Send outreach emails
            // COMMENTED OUT FOR TESTING - Extract individual URLs first
            // await sendEvent({ type: "status", message: "Sending outreach emails..." });
            // 
            // try {
            //   await ctx.runAction(
            //     (api as any).functions.vendorOutreach.actions.sendOutreachEmails,
            //     { ticketId: ticketId as any, userId: user.userId as any }
            //   );
            // } catch (error) {
            //   console.error("Error sending outreach emails:", error);
            // }

            await sendEvent({
              type: "complete",
              vendors: vendorResults,
              source: "database",
              text: `Found ${existingVendors.length} existing vendor(s) in database matching this ticket.`,
            });

            controller.close();
            return;
          }

          // No database vendors found, proceed with web search using agent
          await sendEvent({ type: "status", message: "No existing vendors found. Starting web search..." });

          // Track firecrawlResultsId for linking ticket
          let firecrawlResultsId: Id<"firecrawlResults"> | undefined;
          
          // Create searchVendors tool with callback to save vendors incrementally
          const searchVendors = createSearchVendorsTool({
            onVendorExtracted: async (vendor: any) => {
              // Save vendor incrementally to database
              try {
                const resultId = await ctx.runMutation(
                  (internal as any).functions.firecrawlResults.mutations.appendVendor,
                  { ticketId: ticketId as any, vendor }
                );
                
                // Link ticket to firecrawlResults on first vendor save
                if (!firecrawlResultsId) {
                  firecrawlResultsId = resultId;
                  await ctx.runMutation(
                    (internal as any).functions.firecrawlResults.mutations.linkToTicket,
                    { ticketId: ticketId as any, firecrawlResultsId: resultId }
                  );
                }
                
                // Send streaming event for this vendor
                await sendEvent({
                  type: "vendor_found",
                  vendor,
                  index: allVendors.length + 1,
                  total: 0, // Will be updated when tool completes
                });
                
                allVendors.push(vendor);
              } catch (saveError) {
                console.error(`Error saving vendor ${vendor.businessName} incrementally:`, saveError);
                // Don't re-throw - let extraction continue even if save fails
                // The vendor will still be returned by the tool and can be saved later
              }
            },
          });
          const updateTicket = createUpdateTicketTool(ctx, ticketId as any);

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

          await sendEvent({ type: "status", message: "Searching the web for vendors..." });

          // Stream agent execution
          let stepNumber = 0;
          const allVendors: Array<any> = [];

          // Stream agent steps - agent.stream() returns an object with textStream and fullStream properties
          // According to Vercel AI SDK docs: https://ai-sdk.dev/docs/agents/building-agents
          const streamResult = agent.stream({ prompt });
          
          // Use fullStream to get all events including tool calls, tool results, and text
          // fullStream is an AsyncIterable<TextStreamPart> that includes all stream events
          const fullStream = streamResult.fullStream;
          
          // Iterate over the full stream to capture all agent steps
          // TextStreamPart has different types: 'text', 'tool-call', 'tool-result', 'start-step', 'finish-step', etc.
          try {
            for await (const step of fullStream) {
              // Handle different step types based on TextStreamPart structure
              if (step.type === 'start-step') {
                stepNumber++;
                await sendEvent({ 
                  type: "step", 
                  stepNumber, 
                  description: `Processing step ${stepNumber}...` 
                });
              } else if (step.type === 'tool-call') {
                const toolName = step.toolName;
                const args = step.input;
                
                await sendEvent({
                  type: "tool_call",
                  toolName,
                  args,
                });

                if (toolName === "searchVendors") {
                  await sendEvent({ 
                    type: "status", 
                    message: `Searching for vendors in ${(args as any)?.location || location}...` 
                  });
                }
              } else if (step.type === 'tool-result') {
                const toolName = step.toolName;
                const result = step.output;
                
                await sendEvent({
                  type: "tool_result",
                  toolName,
                  result,
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

                  await sendEvent({ 
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
            await sendEvent({ 
              type: "error", 
              error: `Stream iteration error: ${iterationError instanceof Error ? iterationError.message : String(iterationError)}` 
            });
            controller.close();
            return;
          }

          // Results are already saved incrementally above, but ensure ticket is linked
          // (This is a no-op if already linked, but ensures consistency)
          if (allVendors.length > 0) {
            await sendEvent({ type: "status", message: `Saved ${allVendors.length} vendor(s) to database` });
            
            // Ensure ticket has firecrawlResultsId linked
            const existingResults = await ctx.runQuery(
              (internal as any).functions.firecrawlResults.queries.getByTicketIdInternal,
              { ticketId: ticketId as any }
            );
            
            if (existingResults && !ticket.firecrawlResultsId) {
              await ctx.runMutation(
                (internal as any).functions.tickets.mutations.updateInternal,
                { ticketId: ticketId as any, firecrawlResultsId: existingResults._id }
              );
            }
          }

          // Send outreach emails
          // COMMENTED OUT FOR TESTING - Extract individual URLs first
          // if (allVendors.length > 0) {
          //   await sendEvent({ type: "status", message: "Sending outreach emails..." });
          //   
          //   try {
          //     await ctx.runAction(
          //       (api as any).functions.vendorOutreach.actions.sendOutreachEmails,
          //       { ticketId: ticketId as any, userId: user.userId as any }
          //     );
          //   } catch (error) {
          //     console.error("Error sending outreach emails:", error);
          //   }
          // }

          await sendEvent({
            type: "complete",
            vendors: allVendors,
            source: "web_search",
            text: `Found ${allVendors.length} vendor(s) through web search.`,
          });

          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          const errorEvent = {
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error occurred",
          };
          await sendEvent(errorEvent);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Credentials": "true",
      },
    });
  } catch (error) {
    console.error("Discover vendors stream error:", error);
    return new Response(
      JSON.stringify({ 
        error: getErrorMessage(error),
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

/**
 * Send outreach emails handler
 * POST /api/agents/send-outreach-emails
 */
export const sendOutreachEmailsHandler = httpAction(async (ctx, request) => {
  try {
    const user = await authenticateUser(ctx, request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const body = await request.json();
    const { ticketId } = body;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const result = await ctx.runAction(
      (api as any).functions.vendorOutreach.actions.sendOutreachEmails,
      {
        ticketId: ticketId as any,
        userId: user.userId as any,
      }
    );

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Send outreach emails error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

/**
 * Rank vendors handler
 * POST /api/agents/rank-vendors
 */
export const rankVendorsHandler = httpAction(async (ctx, request) => {
  try {
    const user = await authenticateUser(ctx, request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const body = await request.json();
    const { ticketId } = body;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const result = await ctx.runAction(
      (api as any).functions.agents.vendorRankingAgent.rankVendors,
      {
        ticketId: ticketId as any,
      }
    );

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Rank vendors error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

/**
 * Select vendor handler
 * POST /api/agents/select-vendor
 */
export const selectVendorHandler = httpAction(async (ctx, request) => {
  try {
    const user = await authenticateUser(ctx, request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const body = await request.json();
    const { ticketId, quoteId } = body;

    if (!ticketId || !quoteId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID and Quote ID are required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const result = await ctx.runAction(
      (api as any).functions.vendorQuotes.actions.selectVendor,
      {
        ticketId: ticketId as any,
        quoteId: quoteId as any,
        userId: user.userId as any,
      }
    );

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Select vendor error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

