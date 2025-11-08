/**
 * Password reset actions - Send password reset emails via Resend
 */

"use node";

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { Resend } from "@convex-dev/resend";
import { api, components, internal } from "../../_generated/api";
import { generateSixDigitCode } from "../../utils/codeGeneration";

const resend = new Resend((components as any).resend, {
  testMode: process.env.NODE_ENV !== "production",
});

/**
 * Send password reset code
 * @param userId - User ID
 * @param email - Email address to send code to
 * @returns Reset code that was sent (for testing, remove in production)
 */
export const sendPasswordResetCode = action({
  args: {
    userId: v.id("users"),
    email: v.string(),
  },
  handler: async (ctx, args): Promise<{ code: string }> => {
    // Generate 6-digit code
    const code = generateSixDigitCode();

    // Store code in database
    await ctx.runMutation(
      (internal as any).functions.passwordReset.mutations
        .createResetCodeInternal,
      {
        userId: args.userId,
        email: args.email,
        code,
      }
    );

    // Send email via Resend
    await resend.sendEmail(ctx, {
      from:
        process.env.RESEND_FROM_EMAIL ||
        "Shamp <notifications@shamp.io>",
      to: args.email,
      subject: "Reset your password",
      html: `
        <h2>Password Reset</h2>
        <p>Your password reset code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 8px; text-align: center; margin: 20px 0;">${code}</h1>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
      `,
    });

    // In production, don't return the code
    // For now, return it for testing purposes
    return { code };
  },
});

