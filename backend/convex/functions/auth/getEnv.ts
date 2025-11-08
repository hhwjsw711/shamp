/**
 * Get environment variable action (for HTTP handlers that need env vars)
 */

"use node";

import { action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Get environment variable action
 */
export const getEnvVar = action({
  args: {
    key: v.string(),
    defaultValue: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<string> => {
    return process.env[args.key] || args.defaultValue || "";
  },
});

