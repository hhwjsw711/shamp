/**
 * Upload after photos handler
 * POST /api/tickets/:id/after-photos
 * Uploads photos taken after vendor completes work
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

export const uploadAfterPhotosHandler = httpAction(async (ctx, request) => {
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
        JSON.stringify({ error: "Invalid URL format. Expected: /api/tickets/:id/after-photos" }),
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
        JSON.stringify({ error: "Not authorized to upload photos for this ticket" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let photoIds: string[] = [];

    // Handle multipart/form-data (file upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const files = formData.getAll("files") as File[];

      if (files.length === 0) {
        return new Response(
          JSON.stringify({ error: "No files provided" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // Validate file count (max 5)
      if (files.length > 5) {
        return new Response(
          JSON.stringify({ error: "Maximum 5 photos allowed" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // Upload files and collect photo IDs
      for (const file of files) {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          return new Response(
            JSON.stringify({ error: `Invalid file type: ${file.type}. Only images are allowed.` }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          return new Response(
            JSON.stringify({ error: `File ${file.name} exceeds 10MB size limit` }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }

        const arrayBuffer = await file.arrayBuffer();
        const storageId = await ctx.storage.store(new Blob([arrayBuffer], { type: file.type }));
        photoIds.push(storageId);
      }
    } else {
      // Handle JSON with photoIds array
      const body = await request.json();
      photoIds = body.photoIds || [];

      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "photoIds array is required" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // Validate photo count (max 5)
      if (photoIds.length > 5) {
        return new Response(
          JSON.stringify({ error: "Maximum 5 photos allowed" }),
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

    // Get existing after photos
    const existingAfterPhotos = ticket.afterPhotoIds || [];
    const updatedAfterPhotos = [...existingAfterPhotos, ...photoIds];

    // Update ticket with after photos
    await ctx.runMutation(
      (internal as any).functions.tickets.mutations.updateInternal,
      {
        ticketId: ticketId as any,
        afterPhotoIds: updatedAfterPhotos,
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
    console.error("Upload after photos error:", error);
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

