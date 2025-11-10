/**
 * HTTP handlers for user chat agent
 * POST /api/chat - Chat with the user chat agent
 */

import { httpAction } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

/**
 * Authenticate user from request
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

  return {
    userId: payload.userId as Id<"users">,
  };
}

/**
 * Chat with user chat agent
 * POST /api/chat
 */
export const chatHandler = httpAction(async (ctx, request) => {
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

    const body = await request.json().catch(() => ({}));
    const { message, conversationHistory } = body;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
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

    // Call user chat agent
    const result = await ctx.runAction(
      (api as any).functions.agents.userChatAgent.chatWithUser,
      {
        userId: user.userId,
        message,
        conversationHistory: conversationHistory || [],
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        response: result.text,
        steps: result.steps,
      }),
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
    console.error("Chat handler error:", error);
    
    // Get origin for CORS
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
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

