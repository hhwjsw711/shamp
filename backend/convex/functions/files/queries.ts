/**
 * File queries - Internal queries for file operations
 */

import { internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

/**
 * Verify file ownership by checking if it's associated with user's tickets
 * @param userId - User ID
 * @param fileId - File ID to verify
 * @returns Ticket document if file is owned by user, null otherwise
 */
export const verifyFileOwnershipInternal = internalQuery({
  args: {
    userId: v.id("users"),
    fileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Check if file is associated with user's tickets (photoId or verificationPhotoId)
    const ticketWithPhoto = await ctx.db
      .query("tickets")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .filter((q) => 
        q.or(
          q.eq(q.field("photoId"), args.fileId),
          q.eq(q.field("verificationPhotoId"), args.fileId)
        )
      )
      .first();

    return ticketWithPhoto;
  },
});

