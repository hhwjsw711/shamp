/**
 * Update guest impact handler
 * PATCH /api/tickets/:id/guest-impact
 * Updates guest impact tracking information
 */

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { getErrorMessage } from "../../utils/errors";

/**
 * Helper to authenticate user from cookie or Authorization header
 */
async function authenticateUser(ctx: any, request: Request) {
  const cookieHeader = request.headers.get("cookie");
  
  // Also check Authorization header as fallback for localhost
  const authHeader = request.headers.get("authorization");
  let sessionToken: string | null = null;
  
  // Try cookie first
  if (cookieHeader) {
    sessionToken = await ctx.runAction(
      (api as any).functions.auth.authHelpers.extractSessionTokenAction,
      { cookieHeader }
    );
  }
  
  // Fallback to Authorization header if no cookie (for localhost development)
  if (!sessionToken && authHeader?.startsWith("Bearer ")) {
    sessionToken = authHeader.substring(7);
  }

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

export const updateGuestImpactHandler = httpAction(async (ctx, request) => {
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

    // Extract ticket ID from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const ticketIdIndex = pathParts.indexOf("tickets");
    
    if (ticketIdIndex === -1 || ticketIdIndex + 1 >= pathParts.length) {
      return new Response(
        JSON.stringify({ error: "Invalid URL format. Expected: /api/tickets/:id/guest-impact" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const ticketId = pathParts[ticketIdIndex + 1];

    // Extract guest impact data from request body
    const body = await request.json();
    const {
      affectedRooms,
      guestsAffected,
      guestsNotified,
      guestNotificationMethod,
    } = body;

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
        JSON.stringify({ error: "Not authorized to update guest impact for this ticket" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Validate guestNotificationMethod if provided
    if (
      guestNotificationMethod &&
      !["email", "sms", "phone", "in_person", "none"].includes(guestNotificationMethod)
    ) {
      return new Response(
        JSON.stringify({
          error: "Invalid guestNotificationMethod. Must be one of: email, sms, phone, in_person, none",
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

    // Prepare updates
    const updates: any = {};

    if (affectedRooms !== undefined) {
      if (Array.isArray(affectedRooms)) {
        updates.affectedRooms = affectedRooms;
      } else {
        return new Response(
          JSON.stringify({ error: "affectedRooms must be an array" }),
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

    if (guestsAffected !== undefined) {
      if (typeof guestsAffected === "number" && guestsAffected >= 0) {
        updates.guestsAffected = guestsAffected;
      } else {
        return new Response(
          JSON.stringify({ error: "guestsAffected must be a non-negative number" }),
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

    if (guestsNotified !== undefined) {
      updates.guestsNotified = Boolean(guestsNotified);
      // Set notification timestamp if guests are being marked as notified
      if (guestsNotified && !ticket.guestNotificationSentAt) {
        updates.guestNotificationSentAt = Date.now();
      }
    }

    if (guestNotificationMethod !== undefined) {
      updates.guestNotificationMethod = guestNotificationMethod;
    }

    // Update ticket
    await ctx.runMutation(
      (internal as any).functions.tickets.mutations.updateInternal,
      {
        ticketId: ticketId as any,
        ...updates,
      }
    );

    const updatedTicket = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      { ticketId: ticketId as any }
    );

    return new Response(
      JSON.stringify({ success: true, ticket: updatedTicket }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Update guest impact error:", error);
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

