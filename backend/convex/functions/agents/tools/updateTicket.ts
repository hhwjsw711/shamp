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
  issueType: z.string().optional().describe("Issue type"),
  predictedTags: z.array(z.string()).optional().describe("Predicted tags"),
  problemDescription: z.string().optional().describe("Detailed problem description in simple, plain language"),
  urgency: z.enum(["emergency", "urgent", "normal", "low"]).optional().describe("Urgency level"),
  status: z.enum([
    "pending",
    "analyzed",
    "processing",
    "vendors_available",
    "vendor_selected",
    "vendor_scheduled",
    "fixed",
    "closed"
  ]).optional().describe("Ticket status. Valid values: pending, analyzed, processing, vendors_available, vendor_selected, vendor_scheduled, fixed, closed. For ticket analysis, use 'analyzed'."),
});

type UpdateTicketParams = z.infer<typeof updateTicketSchema>;

export function createUpdateTicketTool(ctx: ActionCtx, ticketId: string) {
  return tool({
    description: "Update ticket fields in the database",
    inputSchema: updateTicketSchema,
    execute: async ({
      issueType,
      predictedTags,
      problemDescription,
      urgency,
      status,
    }: Omit<UpdateTicketParams, "ticketId">) => {
      // Use the ticket ID passed to the tool creation function
      await ctx.runMutation(
        (internal as any).functions.tickets.mutations.updateInternal,
        {
          ticketId: ticketId as any,
          issueType,
          predictedTags,
          problemDescription,
          urgency,
        }
      );

      if (status) {
        await ctx.runMutation(
          (internal as any).functions.tickets.mutations.updateStatusInternal,
          {
            ticketId: ticketId as any,
            status,
          }
        );
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

