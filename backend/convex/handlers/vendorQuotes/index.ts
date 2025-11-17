/**
 * HTTP handlers for vendor quotes
 * GET /api/vendor-quotes - List vendor quotes with pagination
 * GET /api/vendor-quotes/:id - Get vendor quote by ID
 */

import { httpAction } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { getErrorMessage } from "../../utils/errors";

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
    userId: payload.userId,
  };
}

/**
 * List vendor quotes handler
 * GET /api/vendor-quotes
 * Query params: ticketId, vendorId, status, limit, cursor
 */
export const listVendorQuotesHandler = httpAction(async (ctx, request) => {
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

    const url = new URL(request.url);
    const ticketId = url.searchParams.get("ticketId");
    const vendorId = url.searchParams.get("vendorId");
    const status = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor");

    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    let result: {
      quotes: Array<any>;
      nextCursor: string | null;
      hasMore: boolean;
    };

    if (ticketId) {
      // Get quotes for a specific ticket
      const ticketQuotes = await ctx.runQuery(
        (api as any).functions.vendorQuotes.queries.getByTicketId,
        {
          ticketId: ticketId as any,
          userId: user.userId as any, // Pass userId for authorization
          limit,
          cursor: cursor || undefined,
        }
      );
      result = ticketQuotes;
    } else {
      // Get all quotes for the user's tickets
      result = await ctx.runQuery(
        (internal as any).functions.vendorQuotes.queries.getByUserIdInternal,
        {
          userId: user.userId as any,
          limit,
          cursor: cursor || undefined,
        }
      );
    }

    // Filter by vendorId or status if provided (after getting user's quotes)
    let filteredQuotes = result.quotes;
    if (vendorId) {
      filteredQuotes = filteredQuotes.filter((q: any) => q.vendorId === vendorId);
    }
    if (status) {
      filteredQuotes = filteredQuotes.filter((q: any) => q.status === status);
    }

    // Get vendor details for each quote
    const quotesWithVendors = await Promise.all(
      filteredQuotes.map(async (quote: any) => {
        const vendor = await ctx.runQuery(
          (internal as any).functions.vendors.queries.getByIdInternal,
          { vendorId: quote.vendorId }
        );

        const ticket = await ctx.runQuery(
          (internal as any).functions.tickets.queries.getByIdInternal,
          { ticketId: quote.ticketId }
        );

        return {
          id: quote._id,
          ticketId: quote.ticketId,
          ticketDescription: ticket?.description,
          ticketStatus: ticket?.status,
          vendorId: quote.vendorId,
          vendorName: vendor?.businessName || "Unknown",
          vendorEmail: vendor?.email,
          vendorPhone: vendor?.phone,
          vendorSpecialty: vendor?.specialty,
          vendorAddress: vendor?.address,
          vendorRating: vendor?.rating,
          price: quote.price,
          currency: quote.currency,
          estimatedDeliveryTime: quote.estimatedDeliveryTime,
          ratings: quote.ratings,
          status: quote.status,
          score: quote.score,
          responseText: quote.responseText,
          quoteDocumentId: quote.quoteDocumentId,
          quoteDocumentType: quote.quoteDocumentType,
          responseReceivedAt: quote.responseReceivedAt,
          createdAt: quote.createdAt,
          vendorOutreachId: quote.vendorOutreachId,
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        quotes: quotesWithVendors,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        count: quotesWithVendors.length,
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
    console.error("List vendor quotes error:", error);
    
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
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
 * Get vendor quote by ID handler
 * GET /api/vendor-quotes/:id
 */
export const getVendorQuoteByIdHandler = httpAction(async (ctx, request) => {
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

    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const quoteIdIndex = pathParts.indexOf("vendor-quotes");
    
    if (quoteIdIndex === -1 || quoteIdIndex + 1 >= pathParts.length) {
      return new Response(
        JSON.stringify({ error: "Invalid URL format. Expected: /api/vendor-quotes/:id" }),
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

    const quoteId = pathParts[quoteIdIndex + 1];

    const quote = await ctx.runQuery(
      (internal as any).functions.vendorQuotes.queries.getByIdInternal,
      { quoteId: quoteId as any }
    );

    if (!quote) {
      return new Response(
        JSON.stringify({ error: "Quote not found" }),
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

    // Verify user owns the ticket
    const ticket = await ctx.runQuery(
      (internal as any).functions.tickets.queries.getByIdInternal,
      { ticketId: quote.ticketId }
    );

    if (!ticket || ticket.createdBy !== (user.userId as any)) {
      return new Response(
        JSON.stringify({ error: "Not authorized to view this quote" }),
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

    // Get vendor and ticket details
    const vendor = await ctx.runQuery(
      (internal as any).functions.vendors.queries.getByIdInternal,
      { vendorId: quote.vendorId }
    );

    return new Response(
      JSON.stringify({
        success: true,
        quote: {
          id: quote._id,
          ticketId: quote.ticketId,
          ticketDescription: ticket.description,
          ticketStatus: ticket.status,
          vendorId: quote.vendorId,
          vendorName: vendor?.businessName || "Unknown",
          vendorEmail: vendor?.email,
          vendorPhone: vendor?.phone,
          vendorSpecialty: vendor?.specialty,
          vendorAddress: vendor?.address,
          vendorRating: vendor?.rating,
          price: quote.price,
          currency: quote.currency,
          estimatedDeliveryTime: quote.estimatedDeliveryTime,
          ratings: quote.ratings,
          status: quote.status,
          score: quote.score,
          responseText: quote.responseText,
          quoteDocumentId: quote.quoteDocumentId,
          quoteDocumentType: quote.quoteDocumentType,
          responseReceivedAt: quote.responseReceivedAt,
          createdAt: quote.createdAt,
          vendorOutreachId: quote.vendorOutreachId,
        },
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
    console.error("Get vendor quote error:", error);
    
    const origin = request.headers.get("origin");
    const frontendUrl = await ctx.runAction(
      (api as any).functions.auth.getEnv.getEnvVar,
      { key: "FRONTEND_URL", defaultValue: "http://localhost:3000" }
    ) || "http://localhost:3000";
    
    const allowedOrigin = origin || frontendUrl;

    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
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

