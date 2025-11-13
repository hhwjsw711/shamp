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
  testMode: false, // Set to false to allow sending to real email addresses
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

    // Get first photo URL (use first photo if available)
    let photoUrl: string | undefined;
    if (ticket.photoIds && ticket.photoIds.length > 0) {
      photoUrl = await ctx.storage.getUrl(ticket.photoIds[0]) ?? undefined;
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

        // Ensure email body is properly formatted HTML
        // If body is empty or not HTML, wrap it properly
        let emailBody = emailContent.body || "";
        
        // If body doesn't contain HTML tags, wrap it in paragraphs
        if (emailBody && !emailBody.includes("<") && !emailBody.includes(">")) {
          // Convert plain text to HTML by splitting on newlines and wrapping in <p> tags
          const paragraphs = emailBody.split(/\n\n+/).filter(p => p.trim());
          emailBody = paragraphs.map(p => `<p>${p.trim().replace(/\n/g, "<br>")}</p>`).join("");
        }
        
        // If body is still empty, provide a fallback
        if (!emailBody || emailBody.trim() === "") {
          emailBody = `<p>Dear ${vendor.businessName},</p>
<p>We are reaching out regarding a maintenance issue at a hospitality business (hotel or restaurant) in ${location}.</p>
<p><strong>Issue Details:</strong><br>
${ticket.description || "Please see attached images for details."}</p>
<p>We would appreciate a quote for this work, including:</p>
<ul>
<li>Total price/quote (please include currency)</li>
<li>When you can come to fix this issue (specific date/time or date range)</li>
<li>How many hours the fix will take once you arrive</li>
</ul>
<p><strong>About Shamp:</strong><br>
Shamp is a hospitality maintenance platform that connects service providers like yourself with maintenance needs for hotels and restaurants. We help hospitality businesses streamline their maintenance operations by facilitating connections with qualified vendors and collecting competitive quotes to ensure our clients receive the best service options.</p>
<p>We are collecting quotes from multiple vendors to provide the best options to our hospitality client. Please respond within 48-72 hours.</p>
<p>Best regards,<br>Shamp Team</p>`;
        }
        
        // Add photos after the body content
        const photosHtml = photoUrl ? `<br><br><img src="${photoUrl}" alt="Issue photo" style="max-width: 100%; height: auto;">` : "";
        
        const emailId = await resend.sendEmail(ctx, {
          from:
            process.env.RESEND_FROM_EMAIL ||
            "Shamp Notifications <notifications@updates.shamp.io>",
          to: vendor.email,
          replyTo: [
            process.env.RESEND_REPLY_TO_EMAIL || "replies@updates.shamp.io",
          ],
          subject: `[Ticket #${args.ticketId}] ${emailContent.subject || "Maintenance Quote Request"}`,
          html: emailBody + photosHtml,
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
      // Update status to "requested_for_information" when initial emails are sent
      // Update quoteStatus to awaiting_quotes
      await ctx.runMutation(
        (internal as any).functions.tickets.mutations.updateInternal,
        {
          ticketId: args.ticketId,
          status: "requested_for_information",
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

