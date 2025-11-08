/**
 * Email functions
 * Handle sending emails, inbound email webhooks, and email event tracking
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
 * Send email to vendor
 */
export const sendVendorEmail = action({
  args: {
    ticketId: v.id("tickets"),
    vendorId: v.id("vendors"),
    userId: v.id("users"), // User ID passed from HTTP handler after auth
  },
  handler: async (ctx, args): Promise<{
    emailId: string;
    threadId: string;
  }> => {
    // Draft email using agent
    const emailContent = await ctx.runAction(
      (api as any).functions.agents.emailDraftAgent.draftVendorEmail,
      {
        ticketId: args.ticketId,
        vendorId: args.vendorId,
        userId: args.userId,
      }
    );

    // Get ticket and vendor data using internal queries
    const ticket: Doc<"tickets"> | null = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      {
        ticketId: args.ticketId,
      }
    );
    const vendor: Doc<"vendors"> | null = await ctx.runQuery(
      (internal as any).functions.vendors.queries.getByIdInternal,
      {
        vendorId: args.vendorId,
      }
    );

    if (!ticket || !vendor) {
      throw new Error("Ticket or vendor not found");
    }

    // Generate unique thread ID
    const threadId = `ticket-${args.ticketId}-${Date.now()}`;

    // Get photo URL if available
    let photoUrl: string | undefined;
    if (ticket.photoId) {
      photoUrl = await ctx.storage.getUrl(ticket.photoId) ?? undefined;
    }

    // Send email via Resend
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

    // Store email-to-ticket mapping for tracking email events
    await ctx.runMutation(
      (internal as any).functions.emails.mutations.storeEmailMapping,
      {
        emailId: emailId as string,
        ticketId: args.ticketId,
        vendorId: args.vendorId,
      }
    );

    // Create or update conversation
    let conversationId = ticket.conversationId;
    if (!conversationId) {
      conversationId = await ctx.runMutation(
        (api as any).functions.conversations.mutations.createInternal,
        {
          ticketId: args.ticketId,
        }
      );
    }

    // Add initial message to conversation
    await ctx.runMutation(
      (api as any).functions.conversations.mutations.addMessageInternal,
      {
        conversationId,
        sender: "agent",
        message: emailContent.body,
      }
    );

    // Update ticket status
    await ctx.runMutation(
      (api as any).functions.tickets.mutations.updateStatusInternal,
      {
        ticketId: args.ticketId,
        status: "Sent",
      }
    );

    return { emailId, threadId };
  },
});

/**
 * Forward vendor reply to user
 */
export const forwardToUser = action({
  args: {
    ticketId: v.id("tickets"),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const ticket: Doc<"tickets"> | null = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      {
        ticketId: args.ticketId,
      }
    );

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const user: Doc<"users"> | null = await ctx.runQuery(
      (internal as any).functions.auth.queries.getUserByIdInternal,
      {
        userId: ticket.createdBy,
      }
    );

    if (!user || !user.email) {
      throw new Error("User not found or has no email");
    }

    // Send notification email to user
    await resend.sendEmail(ctx, {
      from:
        process.env.RESEND_FROM_EMAIL ||
        "Shamp Notifications <notifications@updates.shamp.io>",
      to: user.email,
      subject: `Update on Ticket #${args.ticketId}`,
      html: `
        <p>You have received a reply on your maintenance ticket.</p>
        <p><strong>Ticket:</strong> ${ticket.description}</p>
        <p><strong>Reply:</strong></p>
        <p>${args.message}</p>
        <p><a href="${process.env.APP_URL || "http://localhost:3000"}/tickets/${args.ticketId}">View ticket in dashboard</a></p>
      `,
    });
  },
});

