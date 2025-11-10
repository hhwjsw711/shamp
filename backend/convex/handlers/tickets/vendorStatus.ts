/**
 * Update vendor status handler
 * PATCH /api/tickets/:id/vendor-status
 * Updates vendor on-site status (arrived, in_progress, completed)
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

export const updateVendorStatusHandler = httpAction(async (ctx, request) => {
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
        JSON.stringify({ error: "Invalid URL format. Expected: /api/tickets/:id/vendor-status" }),
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

    // Extract vendor status from request body
    const body = await request.json();
    const { vendorStatus } = body;

    if (!vendorStatus || !["arrived", "in_progress", "completed"].includes(vendorStatus)) {
      return new Response(
        JSON.stringify({ error: "Valid vendorStatus is required (arrived, in_progress, completed)" }),
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
        JSON.stringify({ error: "Not authorized to update vendor status for this ticket" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Prepare update with timestamps
    const now = Date.now();
    const updates: any = {
      vendorStatus,
    };

    // Set appropriate timestamp based on status
    if (vendorStatus === "arrived" && !ticket.vendorArrivedAt) {
      updates.vendorArrivedAt = now;
    } else if (vendorStatus === "in_progress" && !ticket.vendorStartedAt) {
      updates.vendorStartedAt = now;
    } else if (vendorStatus === "completed" && !ticket.vendorCompletedAt) {
      updates.vendorCompletedAt = now;
    }

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
    console.error("Update vendor status error:", error);
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

