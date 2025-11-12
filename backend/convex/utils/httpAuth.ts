/**
 * Helper function to authenticate user from cookie in HTTP handlers
 * Returns user payload or null if not authenticated
 */
import { api } from "../_generated/api";

export async function authenticateUser(
  ctx: any,
  request: Request
): Promise<{ userId: string; email: string; name?: string } | null> {
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

  return {
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
  };
}

