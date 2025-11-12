/**
 * Vendor Quotes actions
 * Select vendor and send confirmation/rejection emails
 */

"use node";

import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { action } from "../../_generated/server";
import { api, components, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";

const resend = new Resend((components as any).resend, {
  testMode: false, // Set to false to allow sending to real email addresses
  onEmailEvent: (internal as any).functions.emails.mutations.handleEmailEvent as any,
});

/**
 * Select a vendor from recommendations
 */
export const selectVendor = action({
  args: {
    ticketId: v.id("tickets"),
    quoteId: v.id("vendorQuotes"),
    userId: v.id("users"), // User ID passed from HTTP handler after auth
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    vendorId: Id<"vendors">;
    quoteId: Id<"vendorQuotes">;
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
      throw new Error("Not authorized to select vendor for this ticket");
    }

    const quote: Doc<"vendorQuotes"> | null = await ctx.runQuery(
      (internal as any).functions.vendorQuotes.queries.getByIdInternal,
      {
        quoteId: args.quoteId,
      }
    );

    if (!quote) {
      throw new Error("Quote not found");
    }

    if (quote.ticketId !== args.ticketId) {
      throw new Error("Quote does not belong to this ticket");
    }

    if (quote.status !== "received") {
      throw new Error("Quote is not in received status");
    }

    const vendor: Doc<"vendors"> | null = await ctx.runQuery(
      (internal as any).functions.vendors.queries.getByIdInternal,
      {
        vendorId: quote.vendorId,
      }
    );

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    const allQuotes: Array<Doc<"vendorQuotes">> = await ctx.runQuery(
      (internal as any).functions.vendorQuotes.queries.getByTicketIdInternal,
      {
        ticketId: args.ticketId,
      }
    );

    // If a vendor was previously selected, reject that quote first
    if (ticket.selectedVendorQuoteId) {
      const previousQuote = allQuotes.find(
        (q) => q._id === ticket.selectedVendorQuoteId
      );
      if (previousQuote && previousQuote.status === "selected") {
        await ctx.runMutation(
          (internal as any).functions.vendorQuotes.mutations.updateStatus,
          {
            quoteId: previousQuote._id,
            status: "rejected",
          }
        );
      }
    }

    const vendorIds = allQuotes
      .filter(
        (q: Doc<"vendorQuotes">) =>
          q._id !== args.quoteId && q.status === "received"
      )
      .map((q: Doc<"vendorQuotes">) => q.vendorId);

    const vendors: Array<Doc<"vendors"> | null> = await Promise.all(
      vendorIds.map(async (vendorId: Id<"vendors">) =>
        await ctx.runQuery((internal as any).functions.vendors.queries.getByIdInternal, {
          vendorId,
        })
      )
    );

    const vendorMap = new Map<Id<"vendors">, Doc<"vendors">>(
      vendors
        .filter((v): v is Doc<"vendors"> => v !== null)
        .map((v) => [v._id, v])
    );

    await ctx.runMutation(
      (internal as any).functions.vendorQuotes.mutations.updateStatus,
      {
        quoteId: args.quoteId,
        status: "selected",
      }
    );

    for (const otherQuote of allQuotes) {
      if (otherQuote._id !== args.quoteId && otherQuote.status === "received") {
        await ctx.runMutation(
          (internal as any).functions.vendorQuotes.mutations.updateStatus,
          {
            quoteId: otherQuote._id,
            status: "rejected",
          }
        );

        const otherVendor = vendorMap.get(otherQuote.vendorId);

        if (otherVendor && otherVendor.emailStatus !== "doNotEmail") {
          try {
            await resend.sendEmail(ctx, {
              from:
                process.env.RESEND_FROM_EMAIL ||
                "Shamp Notifications <notifications@updates.shamp.io>",
              to: otherVendor.email,
              replyTo: [
                process.env.RESEND_REPLY_TO_EMAIL || "replies@updates.shamp.io",
              ],
              subject: `[Ticket #${args.ticketId}] Thank you for your quote`,
              html: `
                <p>Dear ${otherVendor.businessName},</p>
                <p>Thank you for providing a quote for Ticket #${args.ticketId}.</p>
                <p>We appreciate your time and effort. While we've selected another vendor for this particular job, we'll keep your information on file for future opportunities.</p>
                <p>Thank you for being part of the Shamp network.</p>
                <p>Best regards,<br>Shamp Team</p>
              `,
            });
          } catch (error) {
            console.error(
              `Error sending rejection email to ${otherVendor.email}:`,
              error
            );
          }
        }
      }
    }

    if (vendor.emailStatus !== "doNotEmail") {
      try {
        await resend.sendEmail(ctx, {
          from:
            process.env.RESEND_FROM_EMAIL ||
            "Shamp Notifications <notifications@updates.shamp.io>",
          to: vendor.email,
          replyTo: [
            process.env.RESEND_REPLY_TO_EMAIL || "replies@updates.shamp.io",
          ],
          subject: `[Ticket #${args.ticketId}] Your quote has been selected`,
          html: `
            <p>Dear ${vendor.businessName},</p>
            <p>Congratulations! Your quote for Ticket #${args.ticketId} has been selected.</p>
            ${quote.scheduledDate ? `<p><strong>Scheduled Date:</strong> ${new Date(quote.scheduledDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>` : ""}
            ${quote.fixDuration ? `<p><strong>Estimated Duration:</strong> ${quote.fixDuration} hour${quote.fixDuration !== 1 ? "s" : ""}</p>` : ""}
            ${quote.scheduledDate ? "" : "<p>We'll be in touch shortly to schedule the work.</p>"}
            <p>Thank you for being part of the Shamp network.</p>
            <p>Best regards,<br>Shamp Team</p>
          `,
        });
      } catch (error) {
        console.error(`Error sending confirmation email to ${vendor.email}:`, error);
      }
    }

    // Update ticket with selected vendor and scheduling information
    await ctx.runMutation(
      (internal as any).functions.tickets.mutations.updateInternal,
      {
        ticketId: args.ticketId,
        selectedVendorId: quote.vendorId,
        selectedVendorQuoteId: args.quoteId,
        quoteStatus: "quotes_available",
        status: quote.scheduledDate ? "scheduled" : "quotes_available", // Set to scheduled if scheduledDate is provided
        scheduledDate: quote.scheduledDate, // Use scheduled date from quote
      }
    );

    return {
      success: true,
      vendorId: quote.vendorId,
      quoteId: args.quoteId,
    };
  },
});

