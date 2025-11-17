/**
 * Email attachment utilities
 * Functions to fetch and process attachments from Resend emails
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

/**
 * Fetch attachments from Resend for a received email
 * Uses Resend API to get attachment metadata and download URLs
 * API Reference: https://resend.com/docs/api-reference/emails/list-received-email-attachments
 * Endpoint: GET /emails/receiving/:email_id/attachments
 */
export const fetchEmailAttachments = action({
  args: {
    emailId: v.string(), // Resend email ID from webhook event
  },
  handler: async (ctx, args): Promise<Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
    downloadUrl: string;
    expiresAt: number;
  }>> => {
    // Get Resend API key from environment
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }

    // Call Resend List Attachments API
    // GET /emails/receiving/:email_id/attachments
    // Reference: https://resend.com/docs/api-reference/emails/list-received-email-attachments
    const response = await fetch(
      `https://api.resend.com/emails/receiving/${args.emailId}/attachments`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Resend API error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to fetch attachments: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Resend API returns:
    // {
    //   "object": "list",
    //   "has_more": false,
    //   "data": [
    //     {
    //       "id": "...",
    //       "filename": "...",
    //       "size": 4096,
    //       "content_type": "image/png",
    //       "content_disposition": "inline",
    //       "content_id": "img001",
    //       "download_url": "...",
    //       "expires_at": "2025-10-17T14:29:41.521Z"
    //     }
    //   ]
    // }
    // Reference: https://resend.com/docs/api-reference/emails/list-received-email-attachments
    const attachments = data.data || [];
    
    return attachments.map((attachment: any) => {
      // Parse expires_at ISO string to timestamp
      let expiresAt = Date.now() + 3600000; // Default 1 hour if not provided
      if (attachment.expires_at) {
        const parsedDate = new Date(attachment.expires_at);
        if (!isNaN(parsedDate.getTime())) {
          expiresAt = parsedDate.getTime();
        }
      }

      return {
      id: attachment.id,
      filename: attachment.filename,
        // API returns snake_case 'content_type' (per Resend API docs)
      contentType: attachment.content_type || attachment.contentType || "application/octet-stream",
      size: attachment.size || 0,
        // API returns snake_case 'download_url' (per Resend API docs)
      downloadUrl: attachment.download_url || attachment.downloadUrl,
        expiresAt,
      };
    });
  },
});

/**
 * Download attachment content from Resend download URL
 */
export const downloadAttachment = action({
  args: {
    downloadUrl: v.string(),
    filename: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args): Promise<{
    buffer: ArrayBuffer;
    filename: string;
    contentType: string;
  }> => {
    const response = await fetch(args.downloadUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    
    return {
      buffer,
      filename: args.filename,
      contentType: args.contentType,
    };
  },
});

/**
 * Store attachment in Convex storage
 */
export const storeAttachment = action({
  args: {
    buffer: v.any(), // ArrayBuffer as base64 string or Buffer
    filename: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    // Convert buffer to File for Convex storage
    let file: File;
    
    if (args.buffer instanceof ArrayBuffer) {
      file = new File([args.buffer], args.filename, { type: args.contentType });
    } else if (typeof args.buffer === "string") {
      // If it's a base64 string, decode it
      const binaryString = Buffer.from(args.buffer, "base64").toString("binary");
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      file = new File([bytes], args.filename, { type: args.contentType });
    } else if (args.buffer instanceof Buffer) {
      // If it's a Node.js Buffer, convert to ArrayBuffer
      const arrayBuffer = args.buffer.buffer.slice(
        args.buffer.byteOffset,
        args.buffer.byteOffset + args.buffer.byteLength
      );
      file = new File([arrayBuffer], args.filename, { type: args.contentType });
    } else {
      // Assume it's already a File or Blob
      file = args.buffer instanceof File ? args.buffer : new File([args.buffer], args.filename, { type: args.contentType });
    }

    // Store in Convex storage
    const fileId = await ctx.storage.store(file);
    
    return fileId;
  },
});

