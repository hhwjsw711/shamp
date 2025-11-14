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
import { formatPhoneNumber, isValidPhoneNumber } from "./utils/formatPhoneNumber";

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

    // Track if any calls were made (to update status)
    let callsMade = false;

    // Limit to 1 vendor for testing
    const vendorsToProcess = firecrawlResults.results.slice(0, 1);

    // Update status to "requested_for_information" when outreach starts
    // This happens before the loop so status is updated immediately when we begin outreach
    if (vendorsToProcess.length > 0) {
      await ctx.runMutation(
        (internal as any).functions.tickets.mutations.updateInternal,
        {
          ticketId: args.ticketId,
          status: "requested_for_information",
          quoteStatus: "awaiting_quotes",
        }
      );
    }

    for (const vendorResult of vendorsToProcess) {
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

        // Call vendor first to verify email (if phone number exists and is valid)
        let verifiedEmail: string | null = null;
        if (vendorResult.phone) {
          // Format phone number for Vapi (E.164 format)
          const formattedPhone = formatPhoneNumber(vendorResult.phone);
          
          if (formattedPhone && isValidPhoneNumber(vendorResult.phone)) {
            try {
              callsMade = true;
              
              // Log call start to discovery logs
              await ctx.runMutation(
                (internal as any).functions.discoveryLogs.mutations.addEntry,
                {
                  ticketId: args.ticketId,
                  type: "tool_call",
                  toolName: "callVendor",
                  message: `Calling ${vendorResult.businessName} to verify email address`,
                  toolArgs: {
                    vendorName: vendorResult.businessName,
                    phoneNumber: formattedPhone,
                    originalEmail: vendorResult.email,
                  },
                  timestamp: Date.now(),
                  sequenceNumber: Date.now(), // Use timestamp as sequence for ordering
                }
              );
              
              const orgName = userData?.orgName || "our hospitality business";
              const callResult = await ctx.runAction(
                (api as any).functions.vendorOutreach.callVendor,
                {
                  ticketId: args.ticketId,
                  vendorId,
                  phoneNumber: formattedPhone,
                  originalEmail: vendorResult.email,
                  orgName,
                }
              );

              // Log call result
              if (callResult.success) {
                await ctx.runMutation(
                  (internal as any).functions.discoveryLogs.mutations.addEntry,
                  {
                    ticketId: args.ticketId,
                    type: "tool_result",
                    toolName: "callVendor",
                    message: callResult.verifiedEmail 
                      ? `Call completed. Verified email: ${callResult.verifiedEmail}`
                      : `Call completed. Using original email: ${vendorResult.email}`,
                    toolResult: {
                      success: true,
                      verifiedEmail: callResult.verifiedEmail,
                      vapiCallId: callResult.vapiCallId,
                    },
                    timestamp: Date.now(),
                    sequenceNumber: Date.now() + 1,
                  }
                );
                
                if (callResult.verifiedEmail) {
                  verifiedEmail = callResult.verifiedEmail;
                }
              } else {
                await ctx.runMutation(
                  (internal as any).functions.discoveryLogs.mutations.addEntry,
                  {
                    ticketId: args.ticketId,
                    type: "tool_result",
                    toolName: "callVendor",
                    message: `Call failed: ${callResult.error || "Unknown error"}. Using original email.`,
                    toolResult: {
                      success: false,
                      error: callResult.error,
                    },
                    timestamp: Date.now(),
                    sequenceNumber: Date.now() + 1,
                  }
                );
              }
            } catch (callError) {
              // Continue with original email if call fails
              console.error(
                `Call failed for ${vendorResult.businessName}, using original email:`,
                callError
              );
              
              // Log call error
              await ctx.runMutation(
                (internal as any).functions.discoveryLogs.mutations.addEntry,
                {
                  ticketId: args.ticketId,
                  type: "error",
                  error: `Call failed for ${vendorResult.businessName}: ${callError instanceof Error ? callError.message : String(callError)}`,
                  timestamp: Date.now(),
                  sequenceNumber: Date.now() + 1,
                }
              );
            }
          } else {
            console.warn(
              `Invalid phone number format for ${vendorResult.businessName}: ${vendorResult.phone}. Skipping call.`
            );
          }
        }


        // Use verified email if available, otherwise use original
        const emailToUse = verifiedEmail || vendorResult.email;

        // Get orgName for email draft
        const orgNameForEmail = userData?.orgName || null;
        
        const emailContent = await ctx.runAction(
          (api as any).functions.agents.emailDraftAgent.draftVendorEmail,
          {
            ticketId: args.ticketId,
            vendorId,
            userId: args.userId,
            orgName: orgNameForEmail,
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
          const paragraphs = emailBody.split(/\n\n+/).filter((p: string) => p.trim());
          emailBody = paragraphs.map((p: string) => `<p>${p.trim().replace(/\n/g, "<br>")}</p>`).join("");
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
        
        // Update vendor email if we got a verified one from the call
        if (verifiedEmail && verifiedEmail !== vendor.email) {
          await ctx.runMutation(
            (api as any).functions.vendors.mutations.updateInternal,
            {
              vendorId,
              email: verifiedEmail,
            }
          );
        }

        const emailId = await resend.sendEmail(ctx, {
          from:
            process.env.RESEND_FROM_EMAIL ||
            "Shamp Notifications <notifications@updates.shamp.io>",
          to: emailToUse,
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

        // Save the actual email content to conversation (not just a notification)
        // Strip HTML tags for cleaner conversation display, but keep the content
        const emailTextContent = emailBody
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
          .replace(/&amp;/g, '&') // Replace &amp; with &
          .replace(/&lt;/g, '<') // Replace &lt; with <
          .replace(/&gt;/g, '>') // Replace &gt; with >
          .replace(/&quot;/g, '"') // Replace &quot; with "
          .trim();

        await ctx.runMutation(
          (api as any).functions.conversations.mutations.addMessageInternal,
          {
            conversationId,
            sender: "agent",
            message: emailTextContent || `Quote request sent to ${vendor.businessName}`,
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

    // Status is already updated when outreach starts (line 104-115)
    // Log if no successful sends occurred
    if (successfulSends === 0 && !callsMade) {
      console.error(
        `Failed to make any calls or send any outreach emails for ticket ${args.ticketId}`
      );
    }

    return {
      sent: outreachResults.filter((r) => r.emailId).length,
      failed: outreachResults.filter((r) => r.error).length,
      results: outreachResults,
    };
  },
});

