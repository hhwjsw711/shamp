/**
 * Call Vendor Action
 * Initiate Vapi call to vendor to verify email address
 */

"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { getVendorCallPrompt } from "../../prompts/vendorCall";
import { extractEmailFromTranscript } from "./utils/extractEmailFromTranscript";

const VAPI_API_URL = "https://api.vapi.ai";
const POLL_INTERVAL_MS = 20000; // 20 seconds
const POLL_TIMEOUT_MS = 600000; // 10 minutes

/**
 * Fetch Vapi call status
 */
async function fetchVapiCall(
  vapiCallId: string,
  apiKey: string
): Promise<any> {
  const response = await fetch(`${VAPI_API_URL}/call/${vapiCallId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Vapi API error: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Create Vapi call
 */
async function createVapiCall(
  payload: any,
  apiKey: string
): Promise<string> {
  const response = await fetch(`${VAPI_API_URL}/call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create Vapi call: ${response.status} ${errorText}`
    );
  }

  const json = await response.json();
  const vapiCallId = json?.id || json?.vapiResponse?.id;

  if (!vapiCallId) {
    throw new Error("No vapi_call_id returned from Vapi API");
  }

  return vapiCallId;
}

/**
 * Poll Vapi call until it ends
 */
async function pollVapiCall(
  vapiCallId: string,
  apiKey: string
): Promise<{
  status: string;
  transcript: string | null;
  endedReason: string | null;
  recordingUrl: string | null;
  analysis: any;
}> {
  const pollStart = Date.now();

  while (true) {
    try {
      const callData = await fetchVapiCall(vapiCallId, apiKey);
      const status = callData?.status;

      // Extract transcript from various possible locations
      let transcript: string | null = null;
      if (callData?.artifact?.transcript) {
        transcript = callData.artifact.transcript;
      } else if (Array.isArray(callData?.messages)) {
        transcript = callData.messages
          .map((m: any) => m.message || m.content || "")
          .filter(Boolean)
          .join("\n");
      } else if (callData?.transcript) {
        transcript = callData.transcript;
      }

      const recordingUrl =
        callData?.artifact?.recording?.stereoUrl ||
        callData?.recording?.stereoUrl ||
        null;
      const analysis = callData?.analysis || null;
      const endedReason = callData?.endedReason || null;

      if (status === "ended") {
        return { status, transcript, endedReason, recordingUrl, analysis };
      }

      if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
        throw new Error(
          `Polling timed out after ${POLL_TIMEOUT_MS / 1000}s`
        );
      }

      await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
    } catch (err: any) {
      throw new Error(`Polling error: ${err.message || String(err)}`);
    }
  }
}

/**
 * Call vendor to verify email address
 */
export const callVendor = action({
  args: {
    ticketId: v.id("tickets"),
    vendorId: v.id("vendors"),
    phoneNumber: v.string(),
    originalEmail: v.string(),
    orgName: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    vapiCallId?: string;
    verifiedEmail?: string | null;
    error?: string;
  }> => {
    try {
      // Get API key from environment
      const apiKey = process.env.VAPI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing VAPI_API_KEY environment variable");
      }

      const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
      if (!phoneNumberId) {
        throw new Error("Missing VAPI_PHONE_NUMBER_ID environment variable");
      }

      // Fetch ticket and vendor data
      const ticket = await ctx.runQuery(
        (internal as any).functions.tickets.queries.getByIdInternal,
        { ticketId: args.ticketId }
      );

      if (!ticket) {
        throw new Error("Ticket not found");
      }

      const vendor = await ctx.runQuery(
        (internal as any).functions.vendors.queries.getByIdInternal,
        { vendorId: args.vendorId }
      );

      if (!vendor) {
        throw new Error("Vendor not found");
      }

      // Build system prompt
      const systemPrompt = getVendorCallPrompt({
        ticketDescription: ticket.description,
        vendorName: vendor.businessName,
        issueType: ticket.issueType || "service request",
        location: ticket.location || "property",
        currentEmail: args.originalEmail,
        orgName: args.orgName,
      });

      // Build Vapi call payload
      const vapiPayload = {
        customer: {
          number: args.phoneNumber,
          name: vendor.businessName,
        },
        assistant: {
          name: "Vendor Outreach Assistant",
          model: {
            provider: "openai",
            model: "gpt-4o-realtime-preview-2024-10-01",
            messages: [{ role: "system", content: systemPrompt }],
          },
          voice: "leah-lmnt",
          functions: [
            {
              name: "endCall",
              description:
                "End the call when the conversation is complete or the user indicates they are done.",
              parameters: {
                type: "object",
                properties: {},
              },
            },
            {
              name: "extractEmail",
              description:
                "Extract and record the verified email address from the conversation.",
              parameters: {
                type: "object",
                properties: {
                  email: {
                    type: "string",
                    description: "Verified email address mentioned in the conversation",
                  },
                },
                required: ["email"],
              },
            },
          ],
        },
        metadata: {
          ticketId: args.ticketId,
          vendorId: args.vendorId,
        },
        phoneNumberId,
      };

      // Create call
      const vapiCallId = await createVapiCall(vapiPayload, apiKey);

      // Save initial call log
      await ctx.runMutation(
        (internal as any).functions.vendorCallLogs.mutations.create,
        {
          vapiCallId,
          ticketId: args.ticketId,
          vendorId: args.vendorId,
          vendorName: vendor.businessName,
          phoneNumber: args.phoneNumber,
          originalEmail: args.originalEmail,
          status: "pending",
        }
      );

      // Poll for call completion
      try {
        const callResult = await pollVapiCall(vapiCallId, apiKey);

        // Extract email from transcript
        let verifiedEmail: string | null = null;

        if (callResult.transcript) {
          const extracted = extractEmailFromTranscript(callResult.transcript);
          verifiedEmail = extracted.email;
        }

        // Update call log with results
        // Only include fields that are defined and not null (Convex best practice)
        const updateData: any = {
          vapiCallId,
          status: "ended",
        };

        if (callResult.transcript !== undefined && callResult.transcript !== null) {
          updateData.transcript = callResult.transcript;
        }
        // Only include verifiedEmail if we actually found one (not null)
        if (verifiedEmail !== null && verifiedEmail !== undefined) {
          updateData.verifiedEmail = verifiedEmail;
        }
        if (callResult.endedReason !== undefined && callResult.endedReason !== null) {
          updateData.endedReason = callResult.endedReason;
        }
        if (callResult.recordingUrl !== undefined && callResult.recordingUrl !== null) {
          updateData.recordingUrl = callResult.recordingUrl;
        }
        if (callResult.analysis !== undefined && callResult.analysis !== null) {
          updateData.analysis = callResult.analysis;
        }

        await ctx.runMutation(
          (internal as any).functions.vendorCallLogs.mutations.update,
          updateData
        );

        // Update vendor record with verified email if found
        if (verifiedEmail && verifiedEmail !== args.originalEmail) {
          await ctx.runMutation(
            (api as any).functions.vendors.mutations.updateInternal,
            {
              vendorId: args.vendorId,
              email: verifiedEmail,
            }
          );
        }

        return {
          success: true,
          vapiCallId,
          verifiedEmail,
        };
      } catch (pollError: any) {
        // Update call log with error
        await ctx.runMutation(
          (internal as any).functions.vendorCallLogs.mutations.update,
          {
            vapiCallId,
            status: "poll_error",
            metadata: {
              error: pollError.message || String(pollError),
            },
          }
        );

        return {
          success: false,
          vapiCallId,
          error: pollError.message || "Polling failed",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to call vendor",
      };
    }
  },
});

