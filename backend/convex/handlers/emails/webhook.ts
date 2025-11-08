/**
 * Handle Resend webhook events for outbound email status updates
 * POST /api/emails/webhook
 */

import { httpAction } from "../../_generated/server";
import { components } from "../../_generated/api";
import { Resend } from "@convex-dev/resend";
import { internal } from "../../_generated/api";

const resend = new Resend((components as any).resend, {
  testMode: false,
  onEmailEvent: (internal as any).functions.emails.mutations.handleEmailEvent as any,
});

export const handleWebhook = httpAction(async (ctx, request): Promise<Response> => {
  return await resend.handleResendEventWebhook(ctx, request);
});

