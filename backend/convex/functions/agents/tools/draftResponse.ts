/**
 * Tool for drafting responses to vendors
 */

"use node";

import { z } from "zod";
import { tool } from "ai";
import { api, internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";

const draftResponseSchema = z.object({
  ticketId: z.string().describe("Ticket ID"),
  vendorId: z.string().describe("Vendor ID"),
  message: z.string().describe("Response message to send to vendor"),
  subject: z.string().optional().describe("Email subject line"),
});

type DraftResponseParams = z.infer<typeof draftResponseSchema>;

export function createDraftResponseTool(ctx: ActionCtx) {
  return tool({
    description:
      "Draft a response to a vendor. This creates a draft that the user can review and send. Returns the draft ID and preview of the message.",
    parameters: draftResponseSchema,
    execute: async ({
      ticketId,
      vendorId,
      message,
      subject,
    }: DraftResponseParams) => {
      // Get ticket and vendor for context
      const ticket = await ctx.runQuery(
        (internal as any).functions.tickets.queries.getByIdInternal,
        { ticketId: ticketId as any }
      );

      const vendor = await ctx.runQuery(
        (internal as any).functions.vendors.queries.getByIdInternal,
        { vendorId: vendorId as any }
      );

      if (!ticket || !vendor) {
        return {
          success: false,
          error: "Ticket or vendor not found",
        };
      }

      // Use email draft agent to generate a proper email
      try {
        const draft = await ctx.runAction(
          (api as any).functions.agents.emailDraftAgent.draftEmail,
          {
            ticketId: ticketId as any,
            vendorId: vendorId as any,
            message,
            subject: subject || `Re: Maintenance Request - ${ticket.description.substring(0, 50)}`,
          }
        );

        return {
          success: true,
          draftId: draft.draftId,
          subject: draft.subject,
          body: draft.body,
          preview: draft.body.substring(0, 200),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to draft response",
        };
      }
    },
  } as any);
}

