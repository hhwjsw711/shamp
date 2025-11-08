/**
 * Authentication utilities for session management (non-Node.js functions)
 * These can be used in queries and mutations
 */

import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { AuthenticationError } from "./errors";

/**
 * JWT payload structure
 */
export interface JWTPayload {
  userId: string;
  email?: string;
  name?: string;
  provider: "google" | "email" | "pin";
  pinOwnerId?: string; // For PIN sessions
  type?: "pin_session"; // For PIN sessions
}

/**
 * Get user from session token (for queries/mutations)
 * Note: Token verification must be done in actions, not here
 * @param ctx - Query or Mutation context
 * @param userId - User ID from verified token
 * @returns User document or null
 */
export async function getUserFromSessionId(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<{ _id: Id<"users">; email: string; name?: string } | null> {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  
  return {
    _id: user._id,
    email: user.email,
    name: user.name,
  };
}

/**
 * Require authentication - throws if user is not authenticated
 * @param ctx - Query or Mutation context
 * @param userId - User ID from verified token
 * @returns User document
 * @throws AuthenticationError if not authenticated
 */
export async function requireAuthById(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<{ _id: Id<"users">; email: string; name?: string }> {
  const user = await getUserFromSessionId(ctx, userId);
  if (!user) {
    throw new AuthenticationError("Authentication required");
  }
  return user;
}

