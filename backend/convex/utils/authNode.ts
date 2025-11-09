/**
 * Authentication utilities for Node.js environment (actions and HTTP handlers)
 * These use Node.js APIs like bcrypt, jwt, cookie parsing
 */

"use node";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { parse } from "cookie";
import { SESSION_EXPIRY_DAYS } from "./constants";
import type { JWTPayload } from "./authHelpers";

const JWT_SECRET = process.env.JWT_SECRET || "FAKE_SECRET_MUST_REPLACE";

/**
 * Generate JWT token for authenticated user
 * @param payload - User information to encode in token
 * @returns JWT token string
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SESSION_EXPIRY_DAYS}d` });
}

/**
 * Verify and decode JWT token
 * @param token - JWT token to verify
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract session token from cookie header
 * @param cookieHeader - Cookie header string from request
 * @returns Session token or null
 */
export function extractSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  
  try {
    const cookies = parse(cookieHeader);
    return cookies.session || cookies["session"] || null;
  } catch {
    return null;
  }
}

/**
 * Validate session token and get user ID
 * @param sessionToken - Session token from cookie
 * @returns User ID or null if invalid
 */
export function validateSessionToken(sessionToken: string | null): string | null {
  if (!sessionToken) return null;
  
  const payload = verifyToken(sessionToken);
  return payload?.userId || null;
}

/**
 * Hash password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hash
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns True if password matches
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Hash pin using bcrypt
 * @param pin - Plain text pin
 * @returns Hashed pin
 */
export async function hashPin(pin: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(pin, saltRounds);
}

/**
 * Compare pin with hash
 * @param pin - Plain text pin
 * @param hash - Hashed pin
 * @returns True if pin matches
 */
export async function comparePin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/**
 * Create secure cookie string for session token
 * @param token - JWT token
 * @param maxAge - Max age in seconds (default: 7 days)
 * @param frontendUrl - Frontend URL to determine cookie settings
 * @returns Cookie string
 */
export function createSecureCookie(
  token: string,
  maxAge: number = SESSION_EXPIRY_DAYS * 24 * 60 * 60,
  frontendUrl?: string
): string {
  const isProduction = process.env.NODE_ENV === "production";
  const isLocalhost = frontendUrl?.includes("localhost") || frontendUrl?.includes("127.0.0.1");
  
  // For localhost: use None with Secure=false workaround, or Lax
  // For cross-origin redirects, browsers may reject cookies set FROM different origin
  // Solution: Use SameSite=None with Secure for cross-site, but for localhost we need a workaround
  // Actually, for localhost redirects FROM convex.site, we MUST use SameSite=None and Secure
  // But Secure requires HTTPS... so we need to pass token via URL param for localhost
  
  // Build cookie parts array
  const parts: string[] = [`session=${token}`];
  parts.push("HttpOnly");
  
  if (isLocalhost) {
    // For localhost: Use Lax (works for same-site redirects)
    // But if redirecting FROM convex.site TO localhost, this won't work
    // So we'll use None without Secure as a workaround (some browsers allow this)
    parts.push("SameSite=None");
    // Don't add Secure for localhost HTTP
  } else if (isProduction) {
    // Production: Use None with Secure for cross-site
    parts.push("Secure");
    parts.push("SameSite=None");
    parts.push("Domain=.convex.site");
  } else {
    // Staging/dev: Use Lax with Secure
    parts.push("Secure");
    parts.push("SameSite=Lax");
  }
  
  parts.push("Path=/");
  parts.push(`Max-Age=${maxAge}`);
  
  return parts.join("; ");
}

/**
 * Create cookie deletion string (expires immediately)
 * @param frontendUrl - Frontend URL to determine cookie settings
 * @returns Cookie deletion string
 */
export function createDeleteCookie(frontendUrl?: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  const isLocalhost = frontendUrl?.includes("localhost") || frontendUrl?.includes("127.0.0.1");
  
  const sameSite = isLocalhost ? "Lax" : (isProduction ? "None" : "Lax");
  const secure = isLocalhost ? "" : "Secure";
  const domain = isProduction && !isLocalhost ? "; Domain=.convex.site" : "";
  
  return `session=; HttpOnly; ${secure}; SameSite=${sameSite}; Path=/; Max-Age=0${domain}`.replace(/;\s+/g, "; ").replace(/;\s*$/, "");
}

