/**
 * Tool for updating ticket fields in the database
 */

"use node";

import { z } from "zod";
import { tool } from "ai";
import { api, internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import type { Doc } from "../../../_generated/dataModel";

const updateTicketSchema = z.object({
  ticketName: z.string().optional().describe("Concise name for the ticket (e.g., 'AC Leak in Room 205', 'Broken Door Handle'). Should be brief and descriptive, generated based on the issue type, location, and problem description."),
  issueType: z.string().optional().describe("Issue type"),
  predictedTags: z.array(z.string()).optional().describe("Predicted tags"),
  problemDescription: z.string().optional().describe("Detailed problem description in simple, plain language"),
  urgency: z.enum(["emergency", "urgent", "normal", "low"]).optional().describe("Urgency level"),
  status: z.enum([
    "analyzing",
    "analyzed",
    "reviewed",
    "processing",
    "quotes_available",
    "quote_selected",
    "fixed",
    "closed"
  ]).optional().describe("Ticket status. Valid values: analyzing, analyzed, reviewed, processing, quotes_available, quote_selected, fixed, closed. For ticket analysis, use 'analyzed'."),
});

type UpdateTicketParams = z.infer<typeof updateTicketSchema>;

export function createUpdateTicketTool(ctx: ActionCtx, ticketId: string) {
  return tool({
    description: "Update ticket fields in the database",
    inputSchema: updateTicketSchema,
    execute: async ({
      ticketName,
      issueType,
      predictedTags,
      problemDescription,
      urgency,
      status,
    }: Omit<UpdateTicketParams, "ticketId">) => {
      // Get current ticket to check status before updating
      const currentTicket: Doc<"tickets"> | null = await ctx.runQuery(
        (internal as any).functions.tickets.queries.getByIdInternal,
        { ticketId: ticketId as any }
      );

      if (!currentTicket) {
        throw new Error("Ticket not found");
      }

      // Prevent updating problemDescription during vendor discovery stage
      // problemDescription should only be set during ticket analysis, not during vendor discovery
      // Once ticket is "reviewed" or beyond, problemDescription should not be changed
      const isVendorDiscoveryStage = currentTicket.status === "reviewed" ||
                                      currentTicket.status === "find_vendors" || 
                                      currentTicket.status === "requested_for_information" ||
                                      currentTicket.status === "quotes_available" ||
                                      currentTicket.status === "quote_selected";
      
      // If we're in vendor discovery stage and problemDescription is being updated, ignore it
      // Also prevent updates if problemDescription already exists (it was set during analysis)
      const finalProblemDescription = (isVendorDiscoveryStage || currentTicket.problemDescription) 
        ? undefined 
        : problemDescription;

      // Use the ticket ID passed to the tool creation function
      await ctx.runMutation(
        (internal as any).functions.tickets.mutations.updateInternal,
        {
          ticketId: ticketId as any,
          ticketName,
          issueType,
          predictedTags,
          problemDescription: finalProblemDescription,
          urgency,
        }
      );

      // Only update status if provided AND it's not a regression
      if (status) {
        // Define status progression order
        const statusOrder: Record<string, number> = {
          analyzing: 0,
          analyzed: 1,
          reviewed: 2,
          find_vendors: 3,
          requested_for_information: 4,
          quotes_available: 5,
          quote_selected: 6,
          fixed: 7,
          closed: 8,
        };

        const currentStatusOrder = statusOrder[currentTicket.status] ?? -1;
        const newStatusOrder = statusOrder[status] ?? -1;

        // Only allow status to progress forward (or stay the same)
        // Don't allow regression (e.g., from "processing" back to "analyzed")
        if (newStatusOrder >= currentStatusOrder) {
          await ctx.runMutation(
            (internal as any).functions.tickets.mutations.updateStatusInternal,
            {
              ticketId: ticketId as any,
              status,
            }
          );
        } else {
          console.warn(
            `Status regression prevented in updateTicket tool: Cannot change status from "${currentTicket.status}" to "${status}". Skipping status update.`
          );
        }
      }

      const updated: Doc<"tickets"> | null = await ctx.runQuery(
        (internal as any).functions.tickets.queries.getByIdInternal,
        {
          ticketId: ticketId as any,
        }
      );

      return { ticket: updated };
    },
  } as any);
}

