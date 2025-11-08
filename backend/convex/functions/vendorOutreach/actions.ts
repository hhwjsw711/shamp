/**
 * Vendor Outreach actions
 * Send outreach emails to discovered vendors
 */

"use node";

import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { action } from "../../_generated/server";
import { api, components, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";

const resend = new Resend((components as any).resend, {
  testMode: process.env.NODE_ENV !== "production",
  onEmailEvent: (internal as any).functions.emails.mutations.handleEmailEvent as any,
});

/**
 * Send outreach emails to all discovered vendors for a ticket
 */
export const sendOutreachEmails = action({
  args: {
    ticketId: v.id("tickets"),
    userId: v.id("users"), // User ID passed from HTTP handler after auth
  },
  handler: async (ctx, args): Promise<{
    sent: number;
    failed: number;
    results: Array<{
      vendorId: string;
      emailId?: string;
      error?: string;
    }>;
  }> => {
    const ticket: Doc<"tickets"> | null = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      {
        ticketId: args.ticketId,
      }
    );

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.createdBy !== args.userId) {
      throw new Error("Not authorized to send outreach emails for this ticket");
    }

    if (!ticket.firecrawlResultsId) {
      throw new Error("No vendor discovery results found for this ticket");
    }

    const firecrawlResults: Doc<"firecrawlResults"> | null = await ctx.runQuery(
      (internal as any).functions.firecrawlResults.queries.getByIdInternal,
      {
        resultId: ticket.firecrawlResultsId,
      }
    );
    if (!firecrawlResults || firecrawlResults.results.length === 0) {
      throw new Error("No vendors found in discovery results");
    }

    let photoUrl: string | undefined;
    if (ticket.photoId) {
      photoUrl = await ctx.storage.getUrl(ticket.photoId) ?? undefined;
    }

    const userData: Doc<"users"> | null = await ctx.runQuery(
      (internal as any).functions.auth.queries.getUserByIdInternal,
      {
        userId: ticket.createdBy,
      }
    );
    const location: string = userData?.location || ticket.location || "Not specified";

    let conversationId: Id<"conversations"> | undefined = ticket.conversationId;
    if (!conversationId) {
      conversationId = await ctx.runMutation(
        (api as any).functions.conversations.mutations.createInternal,
        {
          ticketId: args.ticketId,
        }
      );
    }

    const outreachResults: Array<{
      vendorId: string;
      emailId?: string;
      error?: string;
    }> = [];

    const expiresAt: number = Date.now() + 72 * 60 * 60 * 1000;

    for (const vendorResult of firecrawlResults.results) {
      try {
        if (!vendorResult.email) {
          outreachResults.push({
            vendorId: vendorResult.vendorId || "unknown",
            error: "No email address",
          });
          continue;
        }

        let vendorId: Id<"vendors">;
        if (vendorResult.vendorId) {
          vendorId = vendorResult.vendorId as Id<"vendors">;
        } else {
          vendorId = await ctx.runMutation(
            (api as any).functions.vendors.mutations.createInternal,
            {
              businessName: vendorResult.businessName,
              email: vendorResult.email,
              phone: vendorResult.phone,
              specialty: vendorResult.specialty,
              address: vendorResult.address,
              rating: vendorResult.rating,
            }
          );
        }

        const emailContent = await ctx.runAction(
          (api as any).functions.agents.emailDraftAgent.draftVendorEmail,
          {
            ticketId: args.ticketId,
            vendorId,
            userId: args.userId,
          }
        );

        const vendor: Doc<"vendors"> | null = await ctx.runQuery(
          (internal as any).functions.vendors.queries.getByIdInternal,
          {
            vendorId,
          }
        );

        if (!vendor) {
          outreachResults.push({
            vendorId: vendorId as string,
            error: "Vendor not found",
          });
          continue;
        }

        if (
          vendor.emailStatus === "doNotEmail" ||
          vendor.emailStatus === "bounced"
        ) {
          outreachResults.push({
            vendorId: vendorId as string,
            error: `Email status: ${vendor.emailStatus}`,
          });
          continue;
        }

        const emailId = await resend.sendEmail(ctx, {
          from:
            process.env.RESEND_FROM_EMAIL ||
            "Shamp Notifications <notifications@updates.shamp.io>",
          to: vendor.email,
          replyTo: [
            process.env.RESEND_REPLY_TO_EMAIL || "replies@updates.shamp.io",
          ],
          subject: `[Ticket #${args.ticketId}] ${emailContent.subject}`,
          html:
            emailContent.body +
            (photoUrl ? `<br><img src="${photoUrl}" alt="Issue photo">` : ""),
        });

        await ctx.runMutation(
          (internal as any).functions.emails.mutations.storeEmailMapping,
          {
            emailId: emailId as string,
            ticketId: args.ticketId,
            vendorId,
          }
        );

        const outreachId: Id<"vendorOutreach"> = await ctx.runMutation(
          (internal as any).functions.vendorOutreach.mutations.createInternal,
          {
            ticketId: args.ticketId,
            vendorId,
            emailId: emailId as string,
            expiresAt,
          }
        );

        await ctx.scheduler.runAfter(
          0,
          (internal as any).functions.embeddings.actions.generateVendorOutreachEmbedding,
          {
            outreachId,
          }
        );

        await ctx.runMutation(
          (api as any).functions.conversations.mutations.addMessageInternal,
          {
            conversationId,
            sender: "agent",
            message: `Quote request sent to ${vendor.businessName}`,
          }
        );

        outreachResults.push({
          vendorId: vendorId as string,
          emailId: emailId as string,
        });
      } catch (error) {
        console.error(
          `Error sending outreach email to vendor ${vendorResult.businessName}:`,
          error
        );
        outreachResults.push({
          vendorId: vendorResult.vendorId || "unknown",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successfulSends: number = outreachResults.filter((r) => r.emailId).length;

    if (successfulSends > 0) {
      await ctx.runMutation(
        (api as any).functions.tickets.mutations.updateStatusInternal,
        {
          ticketId: args.ticketId,
          status: "Awaiting Vendor",
        }
      );

      await ctx.runMutation(
        (internal as any).functions.tickets.mutations.updateInternal,
        {
          ticketId: args.ticketId,
          quoteStatus: "awaiting_quotes",
        }
      );
    } else {
      console.error(
        `Failed to send any outreach emails for ticket ${args.ticketId}`
      );
    }

    return {
      sent: outreachResults.filter((r) => r.emailId).length,
      failed: outreachResults.filter((r) => r.error).length,
      results: outreachResults,
    };
  },
});

