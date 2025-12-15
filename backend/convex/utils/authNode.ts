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
  // Detect ngrok URLs (supports .ngrok.io, .ngrok-free.app, and .ngrok-free.dev domains)
  const isNgrok = frontendUrl?.includes("ngrok.io") || frontendUrl?.includes("ngrok-free.app") || frontendUrl?.includes("ngrok-free.dev");
  // If using ngrok or production, we have HTTPS - use Secure cookies
  const hasHttps = isNgrok || isProduction || (frontendUrl?.startsWith("https://"));
  
  // Build cookie parts array
  const parts: string[] = [`session=${token}`];
  parts.push("HttpOnly");

  // Best practice: first-party cookies (served from same origin via proxy) + HttpOnly.
  // - In HTTPS: Secure + SameSite=Lax
  // - In localhost HTTP: SameSite=Lax (no Secure)
  // Avoid setting Domain; let the host that serves the response own the cookie.
  if (hasHttps) {
    parts.push("Secure");
  }
  parts.push("SameSite=Lax");
  
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
  const isNgrok = frontendUrl?.includes("ngrok.io") || frontendUrl?.includes("ngrok-free.app") || frontendUrl?.includes("ngrok-free.dev");
  const hasHttps = isNgrok || isProduction || (frontendUrl?.startsWith("https://"));
  
  const sameSite = "Lax";
  const secure = hasHttps ? "Secure" : "";
  
  return `session=; HttpOnly; ${secure}; SameSite=${sameSite}; Path=/; Max-Age=0`
    .replace(/;\s+/g, "; ")
    .replace(/;\s*$/, "");
}

