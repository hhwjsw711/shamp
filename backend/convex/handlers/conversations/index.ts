/**
 * Conversation HTTP handlers
 * POST /api/conversations - Create conversation
 * GET /api/conversations/:id - Get conversation by ID
 * GET /api/conversations/ticket/:ticketId - Get conversation by ticket ID
 * POST /api/conversations/:id/messages - Add message to conversation
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { getErrorMessage } from "../../utils/errors";

/**
 * Helper to authenticate user from cookie
 */
async function authenticateUser(ctx: any, request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const sessionToken = await ctx.runAction(
    (api as any).functions.auth.authHelpers.extractSessionTokenAction,
    { cookieHeader }
  );

  if (!sessionToken) {
    return null;
  }

  const payload = await ctx.runAction(
    (api as any).functions.auth.authHelpers.verifyTokenAction,
    { token: sessionToken }
  );

  if (!payload || !payload.userId) {
    return null;
  }

  return payload;
}

/**
 * Create conversation handler
 * POST /api/conversations
 */
export const createConversationHandler = httpAction(async (ctx, request) => {
  try {
    const user = await authenticateUser(ctx, request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const body = await request.json();
    const { ticketId } = body;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Verify user owns the ticket
    const ticket = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      { ticketId: ticketId as any }
    );

    if (!ticket) {
      return new Response(
        JSON.stringify({ error: "Ticket not found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (ticket.createdBy !== user.userId) {
      return new Response(
        JSON.stringify({
          error: "Not authorized to create conversation for this ticket",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Check if conversation already exists
    const existingConversation = await ctx.runQuery(
      (internal as any).functions.conversations.queries.getByTicketIdInternal,
      { ticketId: ticketId as any }
    );

    if (existingConversation) {
      return new Response(
        JSON.stringify({
          success: true,
          conversation: existingConversation,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const conversationId = await ctx.runMutation(
      (internal as any).functions.conversations.mutations.createInternal,
      {
        ticketId: ticketId as any,
      }
    );

    // Update ticket with conversation ID
    await ctx.runMutation(
      (internal as any).functions.tickets.mutations.updateInternal,
      {
        ticketId: ticketId as any,
        conversationId,
      }
    );

    const conversation = await ctx.runQuery(
      (internal as any).functions.conversations.queries.getByIdInternal,
      { conversationId }
    );

    return new Response(
      JSON.stringify({ success: true, conversation }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Create conversation error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

/**
 * Get conversation by ID handler
 * GET /api/conversations/get?id=...
 */
export const getConversationByIdHandler = httpAction(async (ctx, request) => {
  try {
    const user = await authenticateUser(ctx, request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Extract conversation ID from URL query parameter (GET request)
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("id");

    if (!conversationId) {
      return new Response(
        JSON.stringify({
          error: "Conversation ID is required as query parameter 'id'",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const conversation = await ctx.runQuery(
      (internal as any).functions.conversations.queries.getByIdInternal,
      { conversationId: conversationId as any }
    );

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Verify user owns the ticket
    const ticket = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      { ticketId: conversation.ticketId }
    );

    if (!ticket || ticket.createdBy !== user.userId) {
      return new Response(
        JSON.stringify({
          error: "Not authorized to access this conversation",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, conversation }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Get conversation error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

/**
 * Get conversation by ticket ID handler
 * GET /api/conversations/ticket/:ticketId
 */
export const getConversationByTicketIdHandler = httpAction(
  async (ctx, request) => {
    try {
      const user = await authenticateUser(ctx, request);
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Not authenticated" }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      const url = new URL(request.url);
      const ticketId = url.searchParams.get("ticketId");

      if (!ticketId) {
        return new Response(
          JSON.stringify({ error: "Ticket ID is required" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // Verify user owns the ticket
      const ticket = await ctx.runQuery(
        (internal as any).functions.tickets.queries.getByIdInternal,
        { ticketId: ticketId as any }
      );

      if (!ticket) {
        return new Response(
          JSON.stringify({ error: "Ticket not found" }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      if (ticket.createdBy !== user.userId) {
        return new Response(
          JSON.stringify({
            error: "Not authorized to access conversation for this ticket",
          }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      const conversation = await ctx.runQuery(
        (internal as any).functions.conversations.queries.getByTicketIdInternal,
        { ticketId: ticketId as any }
      );

      return new Response(
        JSON.stringify({ success: true, conversation }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error) {
      console.error("Get conversation by ticket error:", error);
      return new Response(
        JSON.stringify({ error: getErrorMessage(error) }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }
);

/**
 * Add message to conversation handler
 * POST /api/conversations/messages
 */
export const addMessageHandler = httpAction(async (ctx, request) => {
  try {
    const user = await authenticateUser(ctx, request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Extract conversation ID and message data from request body (POST request)
    const body = await request.json();
    const { id: conversationId, sender, message } = body;

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "Conversation ID is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const conversation = await ctx.runQuery(
      (internal as any).functions.conversations.queries.getByIdInternal,
      { conversationId: conversationId as any }
    );

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Verify user owns the ticket (unless sender is agent/vendor)

    if (!sender || !message) {
      return new Response(
        JSON.stringify({ error: "Sender and message are required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (sender === "user") {
      const ticket = await ctx.runQuery(
        (internal as any).functions.tickets.queries.getByIdInternal,
        { ticketId: conversation.ticketId }
      );

      if (!ticket || ticket.createdBy !== user.userId) {
        return new Response(
          JSON.stringify({
            error: "Not authorized to add message to this conversation",
          }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    await ctx.runMutation(
      (internal as any).functions.conversations.mutations.addMessageInternal,
      {
        conversationId: conversationId as any,
        sender: sender as any,
        message,
      }
    );

    const updatedConversation = await ctx.runQuery(
      (internal as any).functions.conversations.queries.getByIdInternal,
      { conversationId: conversationId as any }
    );

    return new Response(
      JSON.stringify({ success: true, conversation: updatedConversation }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Add message error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

