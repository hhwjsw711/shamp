/**
 * Conversation queries - Internal and public queries for conversation data access
 */

import { internalQuery, query } from "../../_generated/server";
import { v } from "convex/values";
import { validateUserId } from "../../utils/queryAuth";

/**
 * Get conversation by ID (internal)
 */
export const getByIdInternal = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

/**
 * Get conversation by ID (public query with authorization)
 * SECURITY: Validates that the conversation's ticket belongs to the requesting user
 */
export const getById = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"), // Required for authorization
  },
  handler: async (ctx, args) => {
    // Validate userId exists
    await validateUserId(ctx, args.userId);
    
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }
    
    // Verify ticket exists and belongs to user
    const ticket = await ctx.db.get(conversation.ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    
    // SECURITY: Ensure ticket belongs to the requesting user
    if (ticket.createdBy !== args.userId) {
      throw new Error("Unauthorized: Conversation ticket does not belong to user");
    }
    
    return conversation;
  },
});

/**
 * Get conversation by ticket ID (internal)
 */
export const getByTicketIdInternal = internalQuery({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .first();
  },
});

/**
 * Get conversation by ticket ID (public query with authorization)
 * SECURITY: Validates that the ticket belongs to the requesting user
 */
export const getByTicketId = query({
  args: {
    ticketId: v.id("tickets"),
    userId: v.id("users"), // Required for authorization
  },
  handler: async (ctx, args) => {
    // Validate userId exists
    await validateUserId(ctx, args.userId);
    
    // Verify ticket exists and belongs to user
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    
    // SECURITY: Ensure ticket belongs to the requesting user
    if (ticket.createdBy !== args.userId) {
      throw new Error("Unauthorized: Ticket does not belong to user");
    }
    
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_ticketId", (q) => q.eq("ticketId", args.ticketId))
      .first();
    
    return conversation || null;
  },
});

