/**
 * Vendor HTTP handlers
 * POST /api/vendors - Create vendor
 * GET /api/vendors/:id - Get vendor by ID
 * GET /api/vendors - List vendors
 * PATCH /api/vendors/:id - Update vendor
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
 * Create vendor handler
 * POST /api/vendors
 */
export const createVendorHandler = httpAction(async (ctx, request) => {
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
    const { businessName, email, phone, specialty, address, rating } = body;

    if (!businessName || !email || !specialty || !address) {
      return new Response(
        JSON.stringify({
          error: "Business name, email, specialty, and address are required",
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

    const vendorId = await ctx.runMutation(
      (internal as any).functions.vendors.mutations.createInternal,
      {
        businessName,
        email,
        phone,
        specialty,
        address,
        rating,
      }
    );

    const vendor = await ctx.runQuery(
      (internal as any).functions.vendors.queries.getByIdInternal,
      { vendorId }
    );

    return new Response(
      JSON.stringify({ success: true, vendor }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Create vendor error:", error);
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
 * Get vendor by ID handler
 * GET /api/vendors/:id
 */
export const getVendorByIdHandler = httpAction(async (ctx, request) => {
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
    const vendorId = url.searchParams.get("id") || (await request.json()).id;

    if (!vendorId) {
      return new Response(
        JSON.stringify({ error: "Vendor ID is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const vendor = await ctx.runQuery(
      (internal as any).functions.vendors.queries.getByIdInternal,
      { vendorId: vendorId as any }
    );

    if (!vendor) {
      return new Response(
        JSON.stringify({ error: "Vendor not found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, vendor }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Get vendor error:", error);
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
 * List vendors handler
 * GET /api/vendors
 */
export const listVendorsHandler = httpAction(async (ctx, request) => {
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

    const vendors = await ctx.runQuery(
      (internal as any).functions.vendors.queries.listInternal,
      {}
    );

    return new Response(
      JSON.stringify({ success: true, vendors }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("List vendors error:", error);
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
 * Update vendor handler
 * PATCH /api/vendors/:id
 */
export const updateVendorHandler = httpAction(async (ctx, request) => {
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
    const body = await request.json();
    const vendorId = url.searchParams.get("id") || body.id;

    if (!vendorId) {
      return new Response(
        JSON.stringify({ error: "Vendor ID is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const {
      businessName,
      email,
      phone,
      specialty,
      address,
      rating,
      emailStatus,
      lastEmailError,
    } = body;

    await ctx.runMutation(
      (internal as any).functions.vendors.mutations.updateInternal,
      {
        vendorId: vendorId as any,
        businessName,
        email,
        phone,
        specialty,
        address,
        rating,
        emailStatus,
        lastEmailError,
      }
    );

    const updatedVendor = await ctx.runQuery(
      (internal as any).functions.vendors.queries.getByIdInternal,
      { vendorId: vendorId as any }
    );

    return new Response(
      JSON.stringify({ success: true, vendor: updatedVendor }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Update vendor error:", error);
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

