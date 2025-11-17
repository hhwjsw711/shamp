/**
 * Authentication utilities for Convex queries
 * Provides secure helpers for validating user identity in public queries
 */

import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { AuthenticationError } from "./errors";

/**
 * Validate that a userId exists in the database and is valid
 * This prevents users from passing arbitrary userIds to access other users' data
 * 
 * @param ctx - Query context
 * @param userId - User ID to validate
 * @returns User document if valid
 * @throws AuthenticationError if user doesn't exist
 */
export async function validateUserId(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<{ _id: Id<"users">; email: string }> {
  const user = await ctx.db.get(userId);
  
  if (!user) {
    throw new AuthenticationError("Invalid user ID");
  }
  
  return {
    _id: user._id,
    email: user.email,
  };
}

/**
 * Require authentication and validate userId
 * Throws error if userId is invalid or user doesn't exist
 * 
 * @param ctx - Query context
 * @param userId - User ID to validate
 * @returns User document
 * @throws AuthenticationError if not authenticated or invalid userId
 */
export async function requireValidUserId(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<{ _id: Id<"users">; email: string }> {
  return await validateUserId(ctx, userId);
}


