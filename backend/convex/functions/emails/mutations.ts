/**
 * Email mutations
 * Internal mutations for email tracking
 */

import { internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import { vEmailId } from "@convex-dev/resend";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";

/**
 * Store email-to-ticket mapping when sending an email
 */
export const storeEmailMapping = internalMutation({
  args: {
    emailId: v.string(),
    ticketId: v.id("tickets"),
    vendorId: v.id("vendors"),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.insert("emailMappings", {
      emailId: args.emailId,
      ticketId: args.ticketId,
      vendorId: args.vendorId,
      sentAt: Date.now(),
      status: "sent",
    });
  },
});

/**
 * Get email mapping by email ID
 */
export const getEmailMappingByEmailId = internalQuery({
  args: { emailId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailMappings")
      .withIndex("by_emailId", (q) => q.eq("emailId", args.emailId))
      .first();
  },
});

type EmailMappingStatus =
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "opened"
  | "clicked";

/**
 * Update email mapping status
 */
export const updateEmailMappingStatus = internalMutation({
  args: {
    emailId: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("opened"),
      v.literal("clicked")
    ),
    bounceReason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const mapping = await ctx.db
      .query("emailMappings")
      .withIndex("by_emailId", (q) => q.eq("emailId", args.emailId))
      .first();

    if (mapping) {
      const update: {
        status: EmailMappingStatus;
        lastEventAt: number;
        bounceReason?: string;
      } = {
        status: args.status as EmailMappingStatus,
        lastEventAt: Date.now(),
      };
      if (args.bounceReason !== undefined) {
        update.bounceReason = args.bounceReason;
      }
      await ctx.db.patch(mapping._id, update);
    }
  },
});

type VendorEmailStatus =
  | "valid"
  | "invalid"
  | "bounced"
  | "complained"
  | "doNotEmail";

/**
 * Update vendor email status
 */
export const updateVendorEmailStatus = internalMutation({
  args: {
    vendorId: v.id("vendors"),
    emailStatus: v.union(
      v.literal("valid"),
      v.literal("invalid"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("doNotEmail")
    ),
    lastEmailError: v.optional(v.string()),
    clearError: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const update: {
      emailStatus: VendorEmailStatus;
      lastEmailError?: string | undefined;
    } = {
      emailStatus: args.emailStatus as VendorEmailStatus,
    };
    if (args.clearError) {
      update.lastEmailError = undefined;
    } else if (args.lastEmailError !== undefined) {
      update.lastEmailError = args.lastEmailError;
    }
    await ctx.db.patch(args.vendorId, update);
  },
});

/**
 * Handle email status events from Resend webhooks
 */
export const handleEmailEvent = internalMutation({
  args: {
    id: vEmailId,
    event: v.any(),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      const eventType = args.event?.type;
      if (!eventType || typeof eventType !== "string" || !eventType.startsWith("email.")) {
        return;
      }

      const emailId = args.id as string;

      const mapping = await ctx.db
        .query("emailMappings")
        .withIndex("by_emailId", (q) => q.eq("emailId", emailId))
        .first();

      if (!mapping) {
        console.warn(`No email mapping found for email ${emailId}`);
        return;
      }

      const { ticketId, vendorId } = mapping;

      if (eventType === "email.bounced") {
        const eventData = args.event?.data || {};
        const bounceReason =
          eventData?.bounce?.reason ||
          eventData?.error ||
          "Unknown bounce reason";

        await ctx.runMutation(
          (internal as any).functions.emails.mutations.updateEmailMappingStatus,
          {
            emailId,
            status: "bounced",
            bounceReason,
          }
        );

        await ctx.runMutation(
          (internal as any).functions.emails.mutations.updateVendorEmailStatus,
          {
            vendorId,
            emailStatus: "bounced",
            lastEmailError: bounceReason,
          }
        );

        const ticket: Doc<"tickets"> | null = await ctx.db.get(ticketId);
        if (ticket && ticket.status === "Sent") {
          await ctx.db.patch(ticketId, {
            status: "Awaiting Vendor",
          });
        }

        console.error(
          `Email ${emailId} bounced for ticket ${ticketId}: ${bounceReason}`
        );
      }

      if (eventType === "email.delivered") {
        await ctx.runMutation(
          (internal as any).functions.emails.mutations.updateEmailMappingStatus,
          {
            emailId,
            status: "delivered",
          }
        );

        const vendor: Doc<"vendors"> | null = await ctx.db.get(vendorId);
        if (vendor && vendor.emailStatus !== "valid") {
          await ctx.runMutation(
            (internal as any).functions.emails.mutations.updateVendorEmailStatus,
            {
              vendorId,
              emailStatus: "valid",
              clearError: true,
            }
          );
        }

        console.log(
          `Email ${emailId} delivered successfully for ticket ${ticketId}`
        );
      }

      if (eventType === "email.complained") {
        await ctx.runMutation(
          (internal as any).functions.emails.mutations.updateEmailMappingStatus,
          {
            emailId,
            status: "complained",
          }
        );

        await ctx.runMutation(
          (internal as any).functions.emails.mutations.updateVendorEmailStatus,
          {
            vendorId,
            emailStatus: "doNotEmail",
            lastEmailError: "Email marked as spam/complaint",
          }
        );

        const ticket: Doc<"tickets"> | null = await ctx.db.get(ticketId);
        if (ticket && ticket.status !== "Fixed") {
          await ctx.db.patch(ticketId, {
            status: "Awaiting Vendor",
          });
        }

        console.warn(
          `Email ${emailId} marked as spam/complaint for ticket ${ticketId}`
        );
      }

      if (eventType === "email.opened") {
        await ctx.runMutation(
          (internal as any).functions.emails.mutations.updateEmailMappingStatus,
          {
            emailId,
            status: "opened",
          }
        );

        console.log(`Email ${emailId} was opened for ticket ${ticketId}`);
      }

      if (eventType === "email.clicked") {
        await ctx.runMutation(
          (internal as any).functions.emails.mutations.updateEmailMappingStatus,
          {
            emailId,
            status: "clicked",
          }
        );

        console.log(`Email ${emailId} had a link clicked for ticket ${ticketId}`);
      }
    } catch (error) {
      console.error(`Error handling email event ${args.id}:`, error);
    }
  },
});
