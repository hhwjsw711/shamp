/**
 * File HTTP handlers
 * POST /api/files/upload - Upload file
 * GET /api/files/:id/url - Get file URL
 * DELETE /api/files/:id - Delete file
 */

/// <reference types="node" />

import { httpAction } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { getErrorMessage } from "../../utils/errors";
import { MAX_FILE_SIZE_BYTES } from "../../utils/constants";

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
 * Upload file handler
 * POST /api/files/upload
 */
export const uploadFileHandler = httpAction(async (ctx, request) => {
  try {
    // Get origin from request header for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    // Authenticate user
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
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
    const fileId = await ctx.storage.store(file);

    return new Response(
      JSON.stringify({ success: true, fileId }),
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
    console.error("[uploadFileHandler] Error:", error);
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
 * Get file URL handler
 * GET /api/files/:id/url
 */
export const getFileUrlHandler = httpAction(async (ctx, request) => {
  try {
    // Get origin from request header for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    // Authenticate user
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

    // Extract file ID from URL
    const url = new URL(request.url);
    const fileId = url.pathname.split("/").pop();

    if (!fileId) {
      return new Response(
        JSON.stringify({ error: "File ID is required" }),
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

    // Verify file ownership by checking if it's associated with user's tickets
    const ticketWithPhoto = await ctx.runQuery(
      (internal as any).functions.files.queries.verifyFileOwnershipInternal,
      { 
        userId: user.userId as any,
        fileId: fileId as any 
      }
    );

    if (!ticketWithPhoto) {
      return new Response(
        JSON.stringify({ error: "Not authorized to access this file" }),
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

    // Get file URL
    const fileUrl = await ctx.storage.getUrl(fileId as any);

    if (!fileUrl) {
      return new Response(
        JSON.stringify({ error: "File not found" }),
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

    return new Response(
      JSON.stringify({ success: true, url: fileUrl }),
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
    console.error("[getFileUrlHandler] Error:", error);
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
 * Delete file handler
 * DELETE /api/files/:id
 */
export const deleteFileHandler = httpAction(async (ctx, request) => {
  try {
    // Get origin from request header for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    // Authenticate user
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

    // Extract file ID from URL
    const url = new URL(request.url);
    const fileId = url.pathname.split("/").pop();

    if (!fileId) {
      return new Response(
        JSON.stringify({ error: "File ID is required" }),
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

    // Verify file ownership by checking if it's associated with user's tickets
    const ticketWithPhoto = await ctx.runQuery(
      (internal as any).functions.files.queries.verifyFileOwnershipInternal,
      { 
        userId: user.userId as any,
        fileId: fileId as any 
      }
    );

    if (!ticketWithPhoto) {
      return new Response(
        JSON.stringify({ error: "Not authorized to delete this file" }),
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

    // Delete file
    await ctx.storage.delete(fileId as any);

    return new Response(
      JSON.stringify({ success: true, message: "File deleted successfully" }),
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
    console.error("[deleteFileHandler] Error:", error);
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

