/**
 * PIN management actions
 * Actions for PIN generation, validation, and hashing (uses Node.js APIs)
 */

"use node";

import { action, internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import bcrypt from "bcryptjs";

/**
 * Generate a random 4-digit PIN
 */
function generateRandomPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Hash PIN using bcrypt
 */
async function hashPin(pin: string): Promise<string> {
  return await bcrypt.hash(pin, 10);
}

/**
 * Compare PIN with hash
 */
async function comparePin(pin: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(pin, hash);
}

/**
 * Generate PIN for user (internal action)
 * Generates PIN, hashes it, and stores it in the database
 * Called during onboarding or PIN regeneration
 */
export const generatePinAction = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<string> => {
    const pin = generateRandomPin();
    const hashedPin = await hashPin(pin);

    await ctx.runMutation(
      internal.functions.pin.mutations.setPinInternal,
      {
        userId: args.userId,
        hashedPin,
      }
    );

    return pin; // Return plain PIN so it can be shown to user once
  },
});

/**
 * Regenerate PIN for user (action)
 * Invalidates old PIN and creates new one
 */
export const regeneratePin = action({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ pin: string }> => {
    const pin = await ctx.runAction(
      internal.functions.pin.actions.generatePinAction,
      { userId: args.userId }
    );

    return { pin };
  },
});

/**
 * Validate PIN and return user ID (action)
 */
export const validatePinAction = action({
  args: {
    pin: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    // PIN must be exactly 4 digits
    if (!/^\d{4}$/.test(args.pin)) {
      return null;
    }

    // Find all users with PIN enabled
    const users = await ctx.runQuery(
      (internal as any).functions.auth.queries.getAllUsersWithPinInternal
    );

    for (const user of users) {
      if (user.pin && (await comparePin(args.pin, user.pin))) {
        return user._id;
      }
    }

    return null;
  },
});

/**
 * Compare PIN action (for HTTP handlers)
 */
export const comparePinAction = action({
  args: {
    pin: v.string(),
    hash: v.string(),
  },
  handler: async (_ctx, args): Promise<boolean> => {
    return await comparePin(args.pin, args.hash);
  },
});

/**
 * Hash PIN action (for HTTP handlers)
 */
export const hashPinAction = action({
  args: {
    pin: v.string(),
  },
  handler: async (_ctx, args): Promise<string> => {
    return await hashPin(args.pin);
  },
});
