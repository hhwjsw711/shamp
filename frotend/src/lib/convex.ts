/**
 * Convex React Client Setup
 * Provides the Convex client for real-time queries and subscriptions
 */

import { ConvexReactClient } from "convex/react";

// Get Convex deployment URL from environment variable
// For queries/mutations, use: https://<deployment-name>.convex.cloud
// This is different from HTTP routes which use .convex.site
const CONVEX_URL =
  import.meta.env.VITE_CONVEX_URL ||
  (() => {
    if (import.meta.env.VITE_CONVEX_SITE_URL) {
      // Convert .convex.site to .convex.cloud for queries
      return import.meta.env.VITE_CONVEX_SITE_URL.replace('.convex.site', '.convex.cloud');
    }
    console.error(
      'Missing VITE_CONVEX_URL environment variable.\n' +
      'Set VITE_CONVEX_URL=https://<your-deployment>.convex.cloud in your .env file.\n' +
      'You can find your deployment URL by running: npx convex dev'
    );
    return '';
  })();

if (!CONVEX_URL) {
  throw new Error(
    'Convex URL is not configured. Please set VITE_CONVEX_URL in your .env file.\n' +
    'For queries/mutations, use: VITE_CONVEX_URL=https://<your-deployment>.convex.cloud'
  );
}

// Create Convex React client
export const convex = new ConvexReactClient(CONVEX_URL);

