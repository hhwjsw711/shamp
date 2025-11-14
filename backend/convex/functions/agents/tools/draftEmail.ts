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
      imageUrl: z.string().optional().describe("URL of the issue photo"),
      orgName: z.string().optional().describe("Organization name (hotel/restaurant name)"),
    }),
    execute: async (params: {
      ticketDetails: string;
      vendorInfo: string;
      location: string;
      imageUrl?: string;
      orgName?: string;
    }) => {
      const { ticketDetails, vendorInfo, location, imageUrl, orgName: paramOrgName } = params;
      const finalOrgName = paramOrgName || orgName;
      const { object } = await generateObject({
        model: openai("gpt-4o"),
        schema: z.object({
          subject: z.string().describe("Email subject line"),
          body: z.string().describe("Professional email body"),
        }),
        prompt: getDraftEmailPrompt({
          vendorInfo,
          location,
          ticketDetails,
          imageUrl,
          orgName: finalOrgName,
        }),
      });

      return object;
    },
  } as any);
}

