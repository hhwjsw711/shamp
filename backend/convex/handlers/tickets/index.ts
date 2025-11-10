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
 * DELETE /api/tickets/:id/photos/:photoId - Delete photo from ticket
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
    let photoIds: string[] = [];
    let issueType: string | undefined;
    let predictedTags: string[] | undefined;
    let name: string | undefined;

    // Handle multipart/form-data (file upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      
      // Extract all files (can be multiple files with same name "files" or "files[]")
      const files: File[] = [];
      const fileEntries = formData.getAll("files");
      
      for (const entry of fileEntries) {
        if (entry instanceof File) {
          files.push(entry);
        }
      }
      
      // Also check for single "file" field (backward compatibility)
      const singleFile = formData.get("file");
      if (singleFile && singleFile instanceof File) {
        files.push(singleFile);
      }

      // Validate file count (max 5)
      if (files.length === 0) {
        return new Response(
          JSON.stringify({ error: "At least one photo is required" }),
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

      if (files.length > 5) {
        return new Response(
          JSON.stringify({ error: "Maximum 5 photos allowed" }),
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

      // Validate and store each file
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      const { MAX_FILE_SIZE_BYTES } = await import("../../utils/constants");

      for (const file of files) {
        // Validate file type
        if (!validTypes.includes(file.type)) {
          return new Response(
            JSON.stringify({ error: `Invalid file type: ${file.name}. Only images are allowed.` }),
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
        if (file.size > MAX_FILE_SIZE_BYTES) {
          return new Response(
            JSON.stringify({ 
              error: `File ${file.name} exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` 
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
        const fileId = await ctx.storage.store(file);
        photoIds.push(fileId);
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
      // Handle JSON request (accepts photoIds array or photoId for backward compatibility)
      const body = await request.json();
      description = body.description;
      location = body.location;
      
      // Support both photoIds array and single photoId (backward compatibility)
      if (body.photoIds && Array.isArray(body.photoIds)) {
        photoIds = body.photoIds;
      } else if (body.photoId) {
        photoIds = [body.photoId];
      }
      
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

    if (photoIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one photo is required" }),
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
        photoIds: photoIds as any[],
        issueType,
        predictedTags: predictedTags || [],
      }
    );

    // Automatically trigger ticket analysis agent
    await ctx.scheduler.runAfter(
      0,
      (api as any).functions.agents.ticketAnalysisAgent.analyzeTicket,
      {
        ticketId,
        userId: user.userId as any,
      }
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

    // Extract ticket ID from URL path (POST /api/tickets/:id/close)
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const ticketIdIndex = pathParts.indexOf("tickets");
    
    if (ticketIdIndex === -1 || ticketIdIndex + 1 >= pathParts.length) {
      return new Response(
        JSON.stringify({ error: "Invalid URL format. Expected: /api/tickets/:id/close" }),
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

    // Extract verification photo ID from request body (optional)
    const body = await request.json().catch(() => ({})); // Handle empty body gracefully
    const { verificationPhotoId } = body;

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

/**
 * Delete photo from ticket handler
 * DELETE /api/tickets/:id/photos/:photoId
 * Deletes a single photo from ticket without deleting the ticket
 */
export const deletePhotoFromTicketHandler = httpAction(async (ctx, request) => {
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

    // Extract ticket ID and photo ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Expected: /api/tickets/:ticketId/photos/:photoId
    const ticketIdIndex = pathParts.indexOf("tickets");
    const photoIdIndex = pathParts.indexOf("photos");
    
    if (ticketIdIndex === -1 || photoIdIndex === -1 || photoIdIndex !== ticketIdIndex + 2) {
      return new Response(
        JSON.stringify({ error: "Invalid URL format. Expected: /api/tickets/:ticketId/photos/:photoId" }),
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

    const ticketId = pathParts[ticketIdIndex + 1];
    const photoId = pathParts[photoIdIndex + 1];

    if (!ticketId || !photoId) {
      return new Response(
        JSON.stringify({ error: "Ticket ID and Photo ID are required" }),
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
        JSON.stringify({ error: "Not authorized to delete photos from this ticket" }),
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

    // Delete photo from ticket
    await ctx.runMutation(
      (internal as any).functions.tickets.mutations.deletePhotoFromTicketInternal,
      { 
        ticketId: ticketId as any,
        photoId: photoId as any,
      }
    );

    // Get updated ticket
    const updatedTicket = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      { ticketId: ticketId as any }
    );

    return new Response(
      JSON.stringify({ success: true, message: "Photo deleted successfully", ticket: updatedTicket }),
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
    console.error("Delete photo from ticket error:", error);
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

