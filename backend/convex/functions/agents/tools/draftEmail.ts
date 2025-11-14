/**
 * Tool for drafting emails to vendors
 */

"use node";

import { generateObject, tool } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { getDraftEmailPrompt } from "../../../prompts/draftEmail";

export function createDraftEmailTool(orgName: string | null = null) {
  return tool({
    description:
      "Draft a professional email to a vendor with ticket details, images, and location",
    inputSchema: z.object({
      ticketDetails: z.string().describe("Ticket description and details"),
      vendorInfo: z.string().describe("Vendor business name and contact info"),
      location: z.string().describe("Location of the issue"),
      imageUrl: z.string().optional().describe("URL of the first issue photo (for backward compatibility)"),
      imageUrls: z.array(z.string()).optional().describe("URLs of all issue photos (use this if multiple photos exist)"),
      orgName: z.string().optional().describe("Organization name (hotel/restaurant name)"),
    }),
    execute: async (params: {
      ticketDetails: string;
      vendorInfo: string;
      location: string;
      imageUrl?: string;
      imageUrls?: string[];
      orgName?: string;
    }) => {
      const { ticketDetails, vendorInfo, location, imageUrl, imageUrls, orgName: paramOrgName } = params;
      const finalOrgName = paramOrgName || orgName;
      // Use imageUrls if provided, otherwise fall back to imageUrl
      const finalImageUrls = imageUrls && imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : undefined);
      const { object } = await generateObject({
        model: openai("gpt-4o"),
        schema: z.object({
          subject: z.string().describe("Email subject line"),
          body: z.string().describe("Professional email body. If multiple images are provided, include all of them in the email body using <img> tags."),
        }),
        prompt: getDraftEmailPrompt({
          vendorInfo,
          location,
          ticketDetails,
          imageUrl: finalImageUrls && finalImageUrls.length > 0 ? finalImageUrls[0] : undefined,
          imageUrls: finalImageUrls,
          orgName: finalOrgName,
        }),
      });

      return object;
    },
  } as any);
}

