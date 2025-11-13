/**
 * Scheduled action to extract vendor information from a single URL
 * Runs as a background job to avoid timeout issues
 */

"use node";

import { v } from "convex/values";
import { action } from "../../../_generated/server";
import { internal } from "../../../_generated/api";
import { VENDOR_EXTRACTION_PROMPT } from "../../../prompts/vendorExtraction";
import type { Id } from "../../../_generated/dataModel";

/**
 * Extract vendor information from a single URL
 * This runs as a scheduled background job to avoid timeout
 */
export const extractVendorUrl = action({
  args: {
    ticketId: v.id("tickets"),
    url: v.string(),
    sequenceNumber: v.number(), // For ordering logs
  },
  handler: async (ctx, args): Promise<{ success: boolean; vendor?: any; error?: string }> => {
    const saveLog = async (type: "status" | "vendor_found" | "error", messageOrVendorOrError: string | any) => {
      try {
        await ctx.runMutation(
          (internal as any).functions.discoveryLogs.mutations.addEntry,
          {
            ticketId: args.ticketId,
            type,
            ...(type === "status" ? { message: messageOrVendorOrError } : {}),
            ...(type === "vendor_found" ? { vendor: messageOrVendorOrError } : {}),
            ...(type === "error" ? { error: messageOrVendorOrError } : {}),
            timestamp: Date.now(),
            sequenceNumber: args.sequenceNumber,
          }
        );
      } catch (dbError) {
        console.error("Error saving discovery log entry:", dbError);
      }
    };

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlApiKey) {
      const error = "FIRECRAWL_API_KEY not configured";
      await saveLog("error", error);
      return { success: false, error };
    }

    try {
      await saveLog("status", `Extracting vendor information from ${args.url}...`);

      // Submit extraction job for single URL
      const extractResponse = await fetch(
        "https://api.firecrawl.dev/v2/extract",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${firecrawlApiKey}`,
          },
          body: JSON.stringify({
            urls: [args.url],
            prompt: VENDOR_EXTRACTION_PROMPT,
            schema: {
              type: "object",
              properties: {
                businessName: {
                  type: "string",
                  description: "The official business name as displayed prominently on the website",
                },
                email: {
                  type: "string",
                  description: "Primary business email address (MANDATORY - must check footer, header, contact pages, all sections)",
                },
                phone: {
                  type: "string",
                  description: "Primary business phone number (MANDATORY - must check footer, header, contact pages, all sections)",
                },
                address: {
                  type: "string",
                  description: "Full business address including street, city, state, and zip code",
                },
                services: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of all services offered by the vendor",
                },
                rating: {
                  type: "number",
                  description: "Customer ratings, review scores, or satisfaction ratings (0-5 scale)",
                },
              },
              required: ["businessName", "email", "phone"],
            },
            enableWebSearch: true,
            includeSubdomains: true,
            scrapeOptions: {
              onlyMainContent: false,
              formats: ["markdown", "html"],
              waitFor: 1000,
            },
          }),
        }
      );

      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        const error = `Firecrawl Extract API error: ${extractResponse.statusText} - ${errorText}`;
        await saveLog("error", error);
        return { success: false, error };
      }

      const extractJobResponse = await extractResponse.json();

      // Check if we got a job ID (async job) or immediate results
      let extractData: any;

      if (extractJobResponse.id) {
        // Job-based extraction - need to poll for completion
        const jobId = extractJobResponse.id;
        const pollInterval = 2000; // Poll every 2 seconds
        const maxAttempts = 300; // Max 10 minutes of polling (300 * 2s = 600s)

        let attempt = 0;
        while (attempt < maxAttempts) {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, pollInterval));

          const statusResponse = await fetch(
            `https://api.firecrawl.dev/v2/extract/${jobId}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${firecrawlApiKey}`,
              },
            }
          );

          if (!statusResponse.ok) {
            const error = `Failed to check extraction status: ${statusResponse.statusText}`;
            await saveLog("error", error);
            return { success: false, error };
          }

          const statusData = await statusResponse.json();

          if (statusData.status === "completed") {
            // Handle different response structures
            extractData = statusData.data || statusData;
            break;
          } else if (statusData.status === "failed" || statusData.status === "cancelled") {
            const error = `Extraction job ${statusData.status}: ${statusData.error || "Unknown error"}`;
            await saveLog("error", error);
            return { success: false, error };
          }
          // Continue polling if status is "processing" or "pending"
        }

        if (!extractData) {
          const error = "Extraction job timed out after maximum polling attempts";
          await saveLog("error", error);
          return { success: false, error };
        }
      } else {
        // Immediate results - handle different response structures
        extractData = extractJobResponse.data || extractJobResponse;
      }

      // Process extraction results - handle different response structures
      let extractedVendors: any[] = [];
      if (extractData && extractData.success && extractData.data) {
        // Response has { success: true, data: {...} } structure
        extractedVendors = Array.isArray(extractData.data) ? extractData.data : [extractData.data];
      } else if (extractData) {
        // Direct data object or array
        extractedVendors = Array.isArray(extractData) ? extractData : [extractData];
      }

      if (extractedVendors.length === 0) {
        await saveLog("status", `No vendor data extracted from ${args.url}`);
        return { success: true }; // Not an error, just no data
      }

      // Process each extracted vendor
      for (const extracted of extractedVendors) {
        if (!extracted || typeof extracted !== "object") continue;

        const vendor = {
          businessName: extracted.businessName || "Unknown",
          email: extracted.email,
          phone: extracted.phone,
          specialty: extracted.specialty || "General",
          address: extracted.address || "",
          rating: extracted.rating,
          url: args.url, // Store the source URL
          description: extracted.description,
          services: extracted.services || [],
        };

        // Validate required fields
        if (!vendor.businessName || !vendor.email || !vendor.phone) {
          console.warn(`Skipping vendor from ${args.url} - missing required fields`);
          continue;
        }

        // Save vendor incrementally to database
        try {
          const resultId = await ctx.runMutation(
            (internal as any).functions.firecrawlResults.mutations.appendVendor,
            { ticketId: args.ticketId, vendor }
          );

          // Link ticket to firecrawlResults on first vendor save
          const ticket = await ctx.runQuery(
            (internal as any).functions.tickets.queries.getByIdInternal,
            { ticketId: args.ticketId }
          );

          if (ticket && !ticket.firecrawlResultsId) {
            await ctx.runMutation(
              (internal as any).functions.tickets.mutations.updateInternal,
              { ticketId: args.ticketId, firecrawlResultsId: resultId }
            );
          }

          // Save log for this vendor
          await saveLog("vendor_found", vendor);

          return { success: true, vendor };
        } catch (saveError) {
          console.error(`Error saving vendor ${vendor.businessName}:`, saveError);
          const error = `Failed to save vendor: ${saveError instanceof Error ? saveError.message : "Unknown error"}`;
          await saveLog("error", error);
          return { success: false, error };
        }
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      await saveLog("error", `Extraction error: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  },
});

