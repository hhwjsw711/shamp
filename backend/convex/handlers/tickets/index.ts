/**
 * Ticket HTTP handlers
 * POST /api/tickets - Create ticket
 * GET /api/tickets/:id - Get ticket by ID
 * GET /api/tickets - List tickets
 * PATCH /api/tickets/:id - Update ticket
 * PATCH /api/tickets/:id/status - Update ticket status
 * POST /api/tickets/:id/assign-vendor - Assign vendor to ticket
 * POST /api/tickets/:id/close - Close ticket
 * POST /api/tickets/:id/schedule - Schedule repair
 * DELETE /api/tickets/:id - Delete ticket
 */

/// <reference types="node" />

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

/**
 * Create ticket handler
 * POST /api/tickets
 * Accepts multipart/form-data with file upload or JSON with photoId
 */
export const createTicketHandler = httpAction(async (ctx, request) => {
  try {
    // Get origin from request header for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    const user = await authenticateUser(ctx, request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    // Verify user exists
    const fullUser = await ctx.runQuery(
      (internal as any).functions.auth.queries.getUserByIdInternal,
      { userId: user.userId as any }
    );

    if (!fullUser) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let description: string;
    let location: string | undefined;
    let photoId: string | undefined;
    let issueType: string | undefined;
    let predictedTags: string[] | undefined;
    let name: string | undefined;

    // Handle multipart/form-data (file upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      
      // Extract file if present
      const file = formData.get("file");
      if (file && file instanceof File) {
        // Validate file type (images only)
        const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!validTypes.includes(file.type)) {
          return new Response(
            JSON.stringify({ error: "Invalid file type. Only images are allowed." }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": allowedOrigin,
                "Access-Control-Allow-Credentials": "true",
              },
            }
          );
        }

        // Validate file size
        const { MAX_FILE_SIZE_BYTES } = await import("../../utils/constants");
        if (file.size > MAX_FILE_SIZE_BYTES) {
          return new Response(
            JSON.stringify({ 
              error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` 
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": allowedOrigin,
                "Access-Control-Allow-Credentials": "true",
              },
            }
          );
        }

        // Store file
        photoId = await ctx.storage.store(file);
      }

      // Extract other fields from form data
      description = formData.get("description") as string || "";
      location = formData.get("location") as string | undefined;
      issueType = formData.get("issueType") as string | undefined;
      name = formData.get("name") as string | undefined;
      
      // Handle predictedTags (could be JSON string or array)
      const tagsValue = formData.get("predictedTags");
      if (tagsValue) {
        if (typeof tagsValue === "string") {
          try {
            predictedTags = JSON.parse(tagsValue);
          } catch {
            predictedTags = [tagsValue];
          }
        } else {
          // FormData.get returns File | string, so if it's not a string, skip it
          predictedTags = undefined;
        }
      }
    } else {
      // Handle JSON request (backward compatibility)
      const body = await request.json();
      description = body.description;
      location = body.location;
      photoId = body.photoId;
      issueType = body.issueType;
      predictedTags = body.predictedTags;
      name = body.name;
    }

    if (!description || typeof description !== "string") {
      return new Response(
        JSON.stringify({ error: "Description is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    const ticketId = await ctx.runMutation(
      (internal as any).functions.tickets.mutations.createInternal,
      {
        createdBy: user.userId as any,
        name: name || fullUser.name, // Use provided name or user's name
        description,
        location,
        photoId: photoId ? (photoId as any) : undefined,
        issueType,
        predictedTags: predictedTags || [],
      }
    );

    const ticket = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      { ticketId }
    );

    return new Response(
      JSON.stringify({ success: true, ticket }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error) {
    console.error("Create ticket error:", error);
    const errorMessage = getErrorMessage(error);
    
    // Get origin for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  }
});

/**
 * Get ticket by ID handler
 * GET /api/tickets/:id
 */
export const getTicketByIdHandler = httpAction(async (ctx, request) => {
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
    const ticketId = url.pathname.split("/").pop();

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required in request body" }),
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
        JSON.stringify({ error: "Not authorized to access this ticket" }),
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
      JSON.stringify({ success: true, ticket }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Get ticket error:", error);
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
 * List tickets handler
 * GET /api/tickets
 */
export const listTicketsHandler = httpAction(async (ctx, request) => {
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
    const status = url.searchParams.get("status");
    const vendorId = url.searchParams.get("vendorId");
    const location = url.searchParams.get("location");
    const tag = url.searchParams.get("tag");

    let tickets;

    if (status) {
      tickets = await ctx.runQuery(
        (internal as any).functions.tickets.queries.listByStatusInternal,
        { status }
      );
    } else if (vendorId) {
      tickets = await ctx.runQuery(
        (internal as any).functions.tickets.queries.listByVendorInternal,
        { vendorId: vendorId as any }
      );
    } else {
      tickets = await ctx.runQuery(
        (internal as any).functions.tickets.queries.listByCreatorInternal,
        { userId: user.userId as any }
      );
    }

    let filtered = tickets;
    if (location) {
      filtered = filtered.filter((t: any) => t.location === location);
    }
    if (tag) {
      filtered = filtered.filter((t: any) => t.predictedTags?.includes(tag));
    }

    return new Response(
      JSON.stringify({ success: true, tickets: filtered }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("List tickets error:", error);
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
 * Update ticket handler
 * PATCH /api/tickets/:id
 */
export const updateTicketHandler = httpAction(async (ctx, request) => {
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

    // Extract ticket ID and other fields from request body (PATCH request)
    const body = await request.json();
    const { id: ticketId, issueType, predictedTags, description, location } = body;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required in request body" }),
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
        JSON.stringify({ error: "Not authorized to update this ticket" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    await ctx.runMutation(
      (internal as any).functions.tickets.mutations.updateInternal,
      {
        ticketId: ticketId as any,
        issueType,
        predictedTags,
        description,
        location,
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
    console.error("Update ticket error:", error);
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
 * Update ticket status handler
 * PATCH /api/tickets/:id/status
 */
export const updateTicketStatusHandler = httpAction(async (ctx, request) => {
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

    // Extract ticket ID and status from request body (PATCH request)
    const body = await request.json();
    const { id: ticketId, status } = body;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required in request body" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (!status || typeof status !== "string") {
      return new Response(
        JSON.stringify({ error: "Status is required" }),
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
        JSON.stringify({ error: "Not authorized to update this ticket" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    await ctx.runMutation(
      (internal as any).functions.tickets.mutations.updateStatusInternal,
      {
        ticketId: ticketId as any,
        status,
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
    console.error("Update ticket status error:", error);
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
 * Assign vendor to ticket handler
 * POST /api/tickets/:id/assign-vendor
 */
export const assignVendorHandler = httpAction(async (ctx, request) => {
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

    // Extract ticket ID and vendor ID from request body (POST request)
    const body = await request.json();
    const { id: ticketId, vendorId } = body;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required in request body" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (!vendorId) {
      return new Response(
        JSON.stringify({ error: "Vendor ID is required in request body" }),
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
        JSON.stringify({ error: "Not authorized to assign vendor to this ticket" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    await ctx.runMutation(
      (internal as any).functions.tickets.mutations.assignVendorInternal,
      {
        ticketId: ticketId as any,
        vendorId: vendorId as any,
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
    console.error("Assign vendor error:", error);
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
 * Close ticket handler
 * POST /api/tickets/:id/close
 */
export const closeTicketHandler = httpAction(async (ctx, request) => {
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

    // Extract ticket ID and verification photo ID from request body (POST request)
    const body = await request.json();
    const { id: ticketId, verificationPhotoId } = body;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required in request body" }),
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
        JSON.stringify({ error: "Not authorized to close this ticket" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    await ctx.runMutation(
      (internal as any).functions.tickets.mutations.closeTicketInternal,
      {
        ticketId: ticketId as any,
        verificationPhotoId: verificationPhotoId ? (verificationPhotoId as any) : undefined,
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
    console.error("Close ticket error:", error);
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
 * Schedule repair handler
 * POST /api/tickets/:id/schedule
 */
export const scheduleRepairHandler = httpAction(async (ctx, request) => {
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

    // Extract ticket ID and scheduled date from request body (POST request)
    const body = await request.json();
    const { id: ticketId, scheduledDate } = body;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required in request body" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (!scheduledDate || typeof scheduledDate !== "number") {
      return new Response(
        JSON.stringify({ error: "Scheduled date is required" }),
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
        JSON.stringify({ error: "Not authorized to schedule this ticket" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    await ctx.runMutation(
      (internal as any).functions.tickets.mutations.scheduleRepairInternal,
      {
        ticketId: ticketId as any,
        scheduledDate,
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
    console.error("Schedule repair error:", error);
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
 * Delete ticket handler
 * DELETE /api/tickets/:id
 * Deletes ticket and associated files from storage
 */
export const deleteTicketHandler = httpAction(async (ctx, request) => {
  try {
    // Get origin from request header for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    const user = await authenticateUser(ctx, request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    // Extract ticket ID from URL
    const url = new URL(request.url);
    const ticketId = url.pathname.split("/").pop();

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Credentials": "true",
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
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    if (ticket.createdBy !== user.userId) {
      return new Response(
        JSON.stringify({ error: "Not authorized to delete this ticket" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    // Delete ticket and associated files
    await ctx.runMutation(
      (internal as any).functions.tickets.mutations.deleteTicketInternal,
      { ticketId: ticketId as any }
    );

    return new Response(
      JSON.stringify({ success: true, message: "Ticket deleted successfully" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error) {
    console.error("Delete ticket error:", error);
    const errorMessage = getErrorMessage(error);
    
    // Get origin for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  }
});

