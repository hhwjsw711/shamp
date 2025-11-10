/**
 * Handle inbound email replies from Resend
 * HTTP handler for receiving vendor email replies
 * POST /api/emails/inbound
 */

import { Resend } from "@convex-dev/resend";
import { httpAction } from "../../_generated/server";
import { api, components, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";

const resend = new Resend((components as any).resend, {
  testMode: false,
  onEmailEvent: (internal as any).functions.emails.mutations.handleEmailEvent as any,
});

/**
 * Helper function to handle conversational response to vendor emails
 * Now includes escalation detection and creation
 */
async function handleConversationalResponse(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  params: {
    ticketId: Id<"tickets">;
    vendorId: Id<"vendors">;
    vendorEmail: string;
    emailBody: string;
    emailSubject: string | null;
    conversation: { _id: Id<"conversations">; messages: Array<any> };
  }
): Promise<void> {
  try {
    // Get ticket to find user
    const ticket: Doc<"tickets"> | null = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      {
        ticketId: params.ticketId,
      }
    );

    if (!ticket) {
      console.error("Ticket not found for conversational response");
      return;
    }

    // Get vendor outreach to find outreach ID
    const outreach: Doc<"vendorOutreach"> | null = await ctx.runQuery(
      (internal as any).functions.vendorOutreach.queries.getByTicketIdAndVendorIdInternal,
      {
        ticketId: params.ticketId,
        vendorId: params.vendorId,
      }
    );

    if (!outreach) {
      console.error("Vendor outreach not found");
      return;
    }

    const conversationResponse = await ctx.runAction(
      (api as any).functions.agents.vendorConversationAgent.generateVendorResponse,
      {
        ticketId: params.ticketId,
        vendorId: params.vendorId,
        vendorEmail: params.vendorEmail,
        vendorMessage: params.emailBody,
        conversationHistory: params.conversation.messages,
      }
    );

    // Check if escalation is needed
    if (conversationResponse.shouldEscalate) {
      // Create escalation
      await ctx.runMutation(
        (internal as any).functions.escalations.mutations.createInternal,
        {
          ticketId: params.ticketId,
          vendorId: params.vendorId,
          vendorOutreachId: outreach._id,
          conversationId: params.conversation._id,
          userId: ticket.createdBy,
          vendorMessage: params.emailBody,
          vendorEmail: params.vendorEmail,
          intent: conversationResponse.intent,
          confidenceScore: conversationResponse.confidenceScore,
          reason:
            conversationResponse.escalationReason ||
            `Low confidence (${conversationResponse.confidenceScore.toFixed(2)}) or complex intent (${conversationResponse.intent})`,
          agentSuggestedResponse: conversationResponse.responseBody,
        }
      );

      // Don't auto-respond if escalated - user will review and respond
      console.log(
        `Escalation created for ticket ${params.ticketId}, vendor ${params.vendorId}`
      );
      return;
    }

    // Auto-respond if not escalated and should respond
    if (conversationResponse.shouldRespond && conversationResponse.responseBody) {
      // Get environment variables using action
      const fromEmail = await ctx.runAction(
        (api as any).functions.auth.getEnv.getEnvVar,
        {
          key: "RESEND_FROM_EMAIL",
          defaultValue: "Shamp Notifications <notifications@updates.shamp.io>",
        }
      );
      const replyToEmail = await ctx.runAction(
        (api as any).functions.auth.getEnv.getEnvVar,
        {
          key: "RESEND_REPLY_TO_EMAIL",
          defaultValue: "replies@updates.shamp.io",
        }
      );

      await resend.sendEmail(ctx, {
        from: fromEmail,
        to: params.vendorEmail,
        replyTo: [replyToEmail],
        subject:
          conversationResponse.responseSubject ||
          `Re: [Ticket #${params.ticketId}] ${params.emailSubject || "Maintenance Request"}`,
        html: conversationResponse.responseBody,
      });

      await ctx.runMutation(
        (api as any).functions.conversations.mutations.addMessageInternal,
        {
          conversationId: params.conversation._id,
          sender: "agent",
          message: conversationResponse.responseBody,
        }
      );
    }
  } catch (error) {
    console.error("Error generating conversational response:", error);
  }
}

/**
 * Handle inbound email replies from Resend's "Receiving Emails" feature
 */
export const handleInboundEmail = httpAction(async (ctx, request) => {
  try {
    const event = await request.json();

    if (event.type !== "email.received") {
      console.warn(`Unexpected event type: ${event.type}`);
      return new Response("OK", { status: 200 });
    }

    const payload = event.data || event;
    const ticketId = extractTicketIdFromReply(payload);

    if (!ticketId) {
      console.warn(
        "Could not extract ticket ID from inbound email:",
        JSON.stringify(payload, null, 2)
      );
      return new Response("OK", { status: 200 });
    }

    if (!isValidTicketId(ticketId)) {
      console.warn(`Invalid ticket ID format: ${ticketId}`);
      return new Response("OK", { status: 200 });
    }

    const conversation: Doc<"conversations"> | null = await ctx.runQuery(
      (internal as any).functions.conversations.queries.getByTicketIdInternal,
      {
        ticketId: ticketId as Id<"tickets">,
      }
    );

    if (!conversation) {
      console.warn(`No conversation found for ticket: ${ticketId}`);
      return new Response("OK", { status: 200 });
    }

    const emailBody: string | null = extractEmailBody(payload);
    const emailSubject: string | null = extractEmailSubject(payload);

    if (!emailBody) {
      console.warn("No email body found in inbound email");
      return new Response("OK", { status: 200 });
    }

    const ticket: Doc<"tickets"> | null = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      {
        ticketId: ticketId as Id<"tickets">,
      }
    );

    if (!ticket) {
      console.warn(`Ticket not found: ${ticketId}`);
      return new Response("OK", { status: 200 });
    }

    const eventData = payload.data || payload;
    const senderEmail: string =
      eventData.from?.email ||
      eventData.from ||
      payload.from?.email ||
      payload.from ||
      "";
    
    // Extract email_id for fetching attachments
    const emailId: string | null =
      eventData.email_id ||
      eventData.emailId ||
      payload.email_id ||
      payload.emailId ||
      null;

    const vendor: Doc<"vendors"> | null = await ctx.runQuery(
      (internal as any).functions.vendors.queries.getByEmailInternal,
      {
        email: senderEmail,
      }
    );

    if (vendor) {
      const outreachRecords: Array<Doc<"vendorOutreach">> = await ctx.runQuery(
        (api as any).functions.vendorOutreach.queries.getByTicketId,
        {
          ticketId: ticketId as Id<"tickets">,
        }
      );

      const outreach = outreachRecords.find(
        (o: Doc<"vendorOutreach">) =>
          o.vendorId === vendor._id && o.status !== "responded"
      );

      if (outreach) {
        try {
          // Process attachments if email_id is available
          let quoteDocumentId: Id<"_storage"> | undefined;
          let quoteDocumentType: string | undefined;
          let documentExtractedText: string | null = null;

          if (emailId) {
            try {
              // Fetch attachments from Resend
              const attachments = await ctx.runAction(
                (api as any).utils.attachmentUtils.fetchEmailAttachments,
                { emailId }
              );

              // Process each attachment (PDFs, images, etc.)
              for (const attachment of attachments) {
                const contentType = attachment.contentType.toLowerCase();
                const isQuoteDocument =
                  contentType.includes("pdf") ||
                  contentType.includes("image") ||
                  attachment.filename.toLowerCase().includes("quote") ||
                  attachment.filename.toLowerCase().includes("estimate") ||
                  attachment.filename.toLowerCase().includes("invoice");

                if (isQuoteDocument) {
                  try {
                    // Download attachment
                    const downloaded = await ctx.runAction(
                      (api as any).utils.attachmentUtils.downloadAttachment,
                      {
                        downloadUrl: attachment.downloadUrl,
                        filename: attachment.filename,
                        contentType: attachment.contentType,
                      }
                    );

                    // Store in Convex storage
                    const storedFileId = await ctx.runAction(
                      (api as any).utils.attachmentUtils.storeAttachment,
                      {
                        buffer: downloaded.buffer,
                        filename: downloaded.filename,
                        contentType: downloaded.contentType,
                      }
                    );

                    quoteDocumentId = storedFileId as Id<"_storage">;
                    quoteDocumentType = contentType.includes("pdf")
                      ? "pdf"
                      : contentType.includes("image")
                      ? "image"
                      : "document";

                    // Extract text from document for parsing
                    // Get file URL from storage (need to use a query/action that can access storage)
                    // For now, we'll pass the file directly to the parser
                    documentExtractedText = await ctx.runAction(
                      (api as any).functions.emails.documentParser.extractTextFromDocument,
                      {
                        fileUrl: attachment.downloadUrl, // Use original download URL before it expires
                        filename: attachment.filename,
                        contentType: attachment.contentType,
                      }
                    );

                    // Only process the first quote document found
                    break;
                  } catch (error) {
                    console.error(`Error processing attachment ${attachment.filename}:`, error);
                    // Continue to next attachment or fall back to email body parsing
                  }
                }
              }
            } catch (error) {
              console.error("Error fetching attachments:", error);
              // Continue with email body parsing as fallback
            }
          }

          // Parse vendor response - use document text if available, otherwise use email body
          const textToParse = documentExtractedText || emailBody;
          let quoteData;

          if (documentExtractedText) {
            // Parse quote from document
            quoteData = await ctx.runAction(
              (api as any).functions.emails.documentParser.parseQuoteFromText,
              {
                extractedText: documentExtractedText,
                ticketDescription: ticket.description,
                issueType: ticket.issueType,
                location: ticket.location,
                vendorBusinessName: vendor.businessName,
              }
            );
          } else {
            // Fall back to email body parsing
            quoteData = await ctx.runAction(
              (api as any).functions.agents.vendorResponseAgent.parseVendorResponse,
              {
                ticketId: ticketId as Id<"tickets">,
                vendorId: vendor._id,
                vendorOutreachId: outreach._id,
                emailBody,
                emailSubject: emailSubject || "",
              }
            );
          }

          if (quoteData.hasQuote && !quoteData.isDeclining) {
            const quoteId: Id<"vendorQuotes"> = await ctx.runMutation(
              (internal as any).functions.vendorQuotes.mutations.createInternal,
              {
                ticketId: ticketId as Id<"tickets">,
                vendorId: vendor._id,
                vendorOutreachId: outreach._id,
                price: quoteData.price!,
                currency: quoteData.currency!,
                estimatedDeliveryTime: quoteData.estimatedDeliveryTime!,
                ratings: quoteData.ratings,
                responseText: emailBody, // Keep original email body
                quoteDocumentId,
                quoteDocumentType,
              }
            );

            await ctx.scheduler.runAfter(
              0,
              (internal as any).functions.embeddings.actions.generateVendorQuoteEmbedding,
              {
                quoteId,
              }
            );

            await ctx.runMutation(
              (internal as any).functions.vendorOutreach.mutations.updateStatus,
              {
                outreachId: outreach._id,
                status: "responded",
              }
            );

            await ctx.runAction(
              (api as any).functions.agents.vendorRankingAgent.rankVendors,
              {
                ticketId: ticketId as Id<"tickets">,
              }
            );

            await ctx.runMutation(
              (internal as any).functions.tickets.mutations.updateInternal,
              {
                ticketId: ticketId as Id<"tickets">,
                quoteStatus: "quotes_received",
              }
            );
          } else if (quoteData.isDeclining) {
            await ctx.runMutation(
              (internal as any).functions.vendorOutreach.mutations.updateStatus,
              {
                outreachId: outreach._id,
                status: "responded",
              }
            );
          }

          await handleConversationalResponse(ctx, {
            ticketId: ticketId as Id<"tickets">,
            vendorId: vendor._id,
            vendorEmail: senderEmail,
            emailBody,
            emailSubject,
            conversation,
          });
        } catch (error) {
          console.error("Error parsing vendor response:", error);
        }
      } else {
        await handleConversationalResponse(ctx, {
          ticketId: ticketId as Id<"tickets">,
          vendorId: vendor._id,
          vendorEmail: senderEmail,
          emailBody,
          emailSubject,
          conversation,
        });
      }
    }

    await ctx.runMutation(
      (api as any).functions.conversations.mutations.addMessageInternal,
      {
        conversationId: conversation._id,
        sender: "vendor",
        message: emailBody,
      }
    );

    if (ticket.status !== "fixed" && ticket.status !== "closed") {
      // Don't update status if ticket is already fixed or closed
      // The ticket status will be managed through other workflows
    }

    await ctx.runAction((api as any).functions.emails.actions.forwardToUser, {
      ticketId: ticketId as Id<"tickets">,
      message: emailBody,
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing inbound email:", error);
    return new Response("OK", { status: 200 });
  }
});

function extractTicketIdFromReply(payload: any): string | null {
  const eventData = payload.data || payload;
  const headers = eventData.headers || payload.headers || {};

  const subject = eventData.subject || payload.subject || headers.subject || "";
  const subjectMatch = subject.match(/\[Ticket #([^\]]+)\]/i);
  if (subjectMatch && subjectMatch[1]) {
    return subjectMatch[1];
  }

  const inReplyTo =
    headers["In-Reply-To"] ||
    headers["in-reply-to"] ||
    eventData["In-Reply-To"] ||
    payload["In-Reply-To"];
  if (inReplyTo) {
    const inReplyToMatch = inReplyTo.match(/ticket-([^-]+)-/);
    if (inReplyToMatch && inReplyToMatch[1]) {
      return inReplyToMatch[1];
    }
  }

  const references =
    headers["References"] ||
    headers["references"] ||
    eventData.References ||
    payload.References;
  if (references) {
    const referencesMatch = references.match(/ticket-([^-]+)-/);
    if (referencesMatch && referencesMatch[1]) {
      return referencesMatch[1];
    }
  }

  const messageId =
    headers["Message-ID"] ||
    headers["message-id"] ||
    eventData["Message-ID"] ||
    payload["Message-ID"];
  if (messageId) {
    const messageIdMatch = messageId.match(/ticket-([^-]+)-/);
    if (messageIdMatch && messageIdMatch[1]) {
      return messageIdMatch[1];
    }
  }

  const body = extractEmailBody(payload);
  if (body) {
    const bodyMatch = body.match(/\[Ticket #([^\]]+)\]/i);
    if (bodyMatch && bodyMatch[1]) {
      return bodyMatch[1];
    }
  }

  return null;
}

function extractEmailBody(payload: any): string | null {
  const eventData = payload.data || payload;

  return (
    eventData.text ||
    eventData.html ||
    eventData.body ||
    payload.text ||
    payload.html ||
    payload.body ||
    payload.content ||
    payload.message ||
    payload["body-plain"] ||
    payload["body-html"] ||
    null
  );
}

function extractEmailSubject(payload: any): string | null {
  const eventData = payload.data || payload;
  const headers = eventData.headers || payload.headers || {};

  return (
    eventData.subject ||
    payload.subject ||
    headers.subject ||
    headers["Subject"] ||
    null
  );
}

function isValidTicketId(id: string): boolean {
  if (!id || typeof id !== "string") {
    return false;
  }
  return /^[a-z0-9]+$/.test(id) && id.length >= 10 && id.length <= 20;
}

