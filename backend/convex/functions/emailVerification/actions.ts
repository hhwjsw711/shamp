/**
 * Email verification actions - Send verification emails via Resend
 */

"use node";

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { Resend } from "@convex-dev/resend";
import { api, components, internal } from "../../_generated/api";
import { generateSixDigitCode } from "../../utils/codeGeneration";

const resend = new Resend((components as any).resend, {
  testMode: false, // Set to false to allow sending to real email addresses
});

/**
 * Send email verification code
 * @param userId - User ID
 * @param email - Email address to send code to
 * @returns Verification code that was sent
 */
export const sendVerificationCode = action({
  args: {
    userId: v.id("users"),
    email: v.string(),
  },
  handler: async (ctx, args): Promise<{ code: string }> => {
    // Generate 6-digit code
    const code = generateSixDigitCode();

    // Store code in database
    await ctx.runMutation(
      (internal as any).functions.emailVerification.mutations
        .createVerificationCodeInternal,
      {
        userId: args.userId,
        email: args.email,
        code,
      }
    );

    // Send email via Resend
    try {
      const emailResult = await resend.sendEmail(ctx, {
        from:
          process.env.RESEND_FROM_EMAIL ||
          "Shamp <notifications@shamp.io>",
        to: args.email,
        subject: "Verify your email address",
        html: `
          <h2>Email Verification</h2>
          <p>Your verification code is:</p>
          <h1 style="font-size: 32px; letter-spacing: 8px; text-align: center; margin: 20px 0;">${code}</h1>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        `,
      });
      console.log(`Email sent successfully to ${args.email}:`, emailResult);
    } catch (emailError) {
      console.error(`Failed to send email to ${args.email}:`, emailError);
      // Re-throw the error so the caller knows email failed
      throw new Error(`Failed to send verification email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`);
    }

    return { code };
  },
});

