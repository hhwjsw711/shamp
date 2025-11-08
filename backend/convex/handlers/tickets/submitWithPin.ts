/**
 * PIN ticket submission handler
 * POST /api/tickets/submit-with-pin
 * Allows unauthenticated users to submit tickets using a PIN session token
 */

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { getErrorMessage } from "../../utils/errors";

/**
 * Submit ticket with PIN handler
 */
export const submitTicketWithPinHandler = httpAction(async (ctx, request) => {
  try {
    const body = await request.json();
    const { token, description, photoId, name, location, submittedByEmail, submittedByPhone } = body;

    // Validate token
    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Verify token
    const payload = await ctx.runAction(
      (api as any).functions.auth.authHelpers.verifyTokenAction,
      { token }
    );
    if (!payload || payload.type !== "pin_session" || !payload.pinOwnerId) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Check PIN session is still valid
    const pinSession = await ctx.runQuery(
      (internal as any).functions.pinSessions.queries.getPinSessionByTokenInternal,
      { sessionToken: token }
    );

    if (!pinSession) {
      return new Response(
        JSON.stringify({ error: "Session expired. Please validate PIN again." }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Validate required fields
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Description is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (!photoId || typeof photoId !== "string") {
      return new Response(
        JSON.stringify({ error: "Photo is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Get PIN owner user
    const pinOwner = await ctx.runQuery(
      (internal as any).functions.auth.queries.getUserByIdInternal,
      { userId: pinSession.pinOwnerId }
    );

    if (!pinOwner) {
      return new Response(
        JSON.stringify({ error: "PIN owner not found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Create ticket
    const ticketId = await ctx.runMutation(
      (internal as any).functions.tickets.mutations.createInternal,
      {
        createdBy: pinOwner._id, // PIN owner is the ticket creator
        name: name || undefined, // Optional name from submitter
        description: description.trim(),
        photoId: photoId as any,
        location: location || undefined,
        status: "New",
        submittedViaPin: true,
        pinOwnerId: pinOwner._id,
        submittedByEmail: submittedByEmail || undefined,
        submittedByPhone: submittedByPhone || undefined,
      }
    );

    // Trigger ticket analysis agent (same as regular tickets)
    await ctx.scheduler.runAfter(
      0,
      (api as any).functions.agents.ticketAnalysisAgent.analyzeTicket,
      { ticketId }
    );

    // Generate embedding for ticket
    await ctx.scheduler.runAfter(
      0,
      (internal as any).functions.embeddings.actions.generateTicketEmbedding,
      { ticketId }
    );

    const ticket = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      { ticketId }
    );

    return new Response(
      JSON.stringify({
        success: true,
        ticket,
        message: "Ticket submitted successfully",
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Submit ticket with PIN error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

