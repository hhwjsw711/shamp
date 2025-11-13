/**
 * Tool for searching vendors using Firecrawl Search and Extract APIs
 */

"use node";

import { tool } from "ai";
import { z } from "zod";
import { VENDOR_EXTRACTION_PROMPT } from "../../../prompts/vendorExtraction";

const searchVendorsSchema = z.object({
  location: z.string().describe("Location to search for vendors"),
  tags: z.array(z.string()).describe("Issue tags to match vendor specialties"),
  specialty: z
    .string()
    .optional()
    .describe("Specific vendor specialty to search for"),
});

type SearchVendorsParams = z.infer<typeof searchVendorsSchema>;

/**
 * Extract vendor information from a single URL
 * Helper function for parallel processing
 */
async function extractVendorFromUrl(
  url: string,
  searchResult: any,
  specialty: string | undefined,
  tags: Array<string>,
  location: string,
  firecrawlApiKey: string,
  onVendorExtracted?: (vendor: any) => Promise<void>
): Promise<any> {
  try {
    console.log(`Extracting vendor from ${url}...`);

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
          urls: [url],
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
      console.error(`Firecrawl Extract API error for ${url}: ${extractResponse.statusText} - ${errorText}`);
      return null;
    }

    const extractJobResponse = await extractResponse.json();

    // Check if we got a job ID (async job) or immediate results
    let extractData: any;

    if (extractJobResponse.id) {
      // Job-based extraction - need to poll for completion
      const jobId = extractJobResponse.id;
      const pollInterval = 2000; // Poll every 2 seconds
      const maxAttempts = 150; // Max 5 minutes of polling (150 * 2s = 300s)

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
          console.error(`Failed to check extraction job status for ${url}: ${statusResponse.statusText}`);
          return null;
        }

        const statusData = await statusResponse.json();

        if (statusData.status === "completed") {
          extractData = statusData.data || statusData;
          break;
        } else if (statusData.status === "failed" || statusData.status === "cancelled") {
          console.error(`Extraction job ${statusData.status} for ${url}:`, statusData.error);
          return null;
        }
        // Continue polling if status is "processing" or "pending"
      }

      if (!extractData) {
        console.warn(`Extraction job timed out for ${url} after ${maxAttempts} attempts`);
        return null;
      }
    } else {
      // Immediate results
      extractData = extractJobResponse.data || extractJobResponse;
    }

    // Process extraction results - handle different response structures
    let extractedVendors: any[] = [];
    if (extractData && extractData.success && extractData.data) {
      extractedVendors = Array.isArray(extractData.data) ? extractData.data : [extractData.data];
    } else if (extractData) {
      extractedVendors = Array.isArray(extractData) ? extractData : [extractData];
    }

    if (extractedVendors.length === 0) {
      console.warn(`No vendor data extracted from ${url}`);
      return null;
    }

    // Process first extracted vendor (should be one per URL)
    const extracted = extractedVendors[0];
    if (!extracted || typeof extracted !== "object") {
      return null;
    }

    const vendor = {
      businessName: extracted.businessName || searchResult?.title || "Unknown",
      email: extracted.email || undefined,
      phone: extracted.phone || undefined,
      specialty: specialty || tags[0] || "General",
      address:
        extracted.address ||
        searchResult?.metadata?.address ||
        location,
      rating: extracted.rating || searchResult?.metadata?.rating || undefined,
      url: url,
      description: searchResult?.description,
      position: searchResult?.position || 1,
      services: Array.isArray(extracted.services) ? extracted.services : [],
    };

    // Validate required fields
    if (!vendor.businessName || !vendor.email || !vendor.phone) {
      console.warn(`Skipping vendor from ${url} - missing required fields`);
      return null;
    }

    // Call callback to save vendor incrementally
    if (onVendorExtracted) {
      try {
        await onVendorExtracted(vendor);
        console.log(`✓ Saved vendor ${vendor.businessName} to database incrementally`);
      } catch (saveError) {
        console.error(`Error saving vendor incrementally:`, saveError);
        // Continue even if save fails
      }
    }

    return vendor;
  } catch (error) {
    console.error(`Error extracting ${url}:`, error);
    return null;
  }
}

/**
 * Process URLs in parallel with concurrency limit
 */
async function processUrlsInParallel(
  urls: Array<string>,
  webResults: Array<any>,
  specialty: string | undefined,
  tags: Array<string>,
  location: string,
  firecrawlApiKey: string,
  onVendorExtracted?: (vendor: any) => Promise<void>,
  concurrencyLimit: number = 3
): Promise<Array<any>> {
  const vendors: Array<any> = [];
  
  // Process URLs in batches to respect concurrency limit
  for (let i = 0; i < urls.length; i += concurrencyLimit) {
    const batch = urls.slice(i, i + concurrencyLimit);
    const batchResults = webResults.slice(i, i + concurrencyLimit);
    
    console.log(`Processing batch ${Math.floor(i / concurrencyLimit) + 1}: ${batch.length} URLs in parallel`);
    
    // Process batch in parallel
    const batchPromises = batch.map((url, batchIndex) =>
      extractVendorFromUrl(
        url,
        batchResults[batchIndex],
        specialty,
        tags,
        location,
        firecrawlApiKey,
        onVendorExtracted
      )
    );
    
    // Wait for all in batch to complete (or fail)
    const batchResults_array = await Promise.allSettled(batchPromises);
    
    // Collect successful extractions
    for (const result of batchResults_array) {
      if (result.status === "fulfilled" && result.value) {
        vendors.push(result.value);
      }
    }
  }
  
  return vendors;
}

export function createSearchVendorsTool(options?: {
  onVendorExtracted?: (vendor: any) => Promise<void>;
}) {
  return tool({
    description:
      "Search for local vendors using Firecrawl Search API to discover URLs, then extract vendor information in parallel.",
    inputSchema: searchVendorsSchema,
    execute: async ({ location, tags, specialty }: SearchVendorsParams) => {
      const searchQuery = `${specialty || tags.join(" ")} ${location} maintenance repair service`;

      // Call Firecrawl v2 Search API to discover vendor URLs
      const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
      if (!firecrawlApiKey) {
        throw new Error("FIRECRAWL_API_KEY not configured");
      }

      const searchResponse = await fetch(
        "https://api.firecrawl.dev/v2/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${firecrawlApiKey}`,
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 10,
            location: location,
            sources: ["web"],
          }),
        }
      );

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error(
          `Firecrawl Search API error: ${searchResponse.statusText} - ${errorText}`
        );
      }

      const searchData = await searchResponse.json();

      // Log the response structure for debugging
      console.log("Firecrawl Search API response:", JSON.stringify(searchData, null, 2));

      // Get URLs from search results - handle different response structures
      // API v2 might return: { data: { web: [...] } } or { web: [...] }
      const webResults = searchData.data?.web || searchData.web || [];

      console.log(`Found ${webResults.length} web results from Firecrawl Search`);

      if (webResults.length === 0) {
        console.warn("No web results found in Firecrawl Search response");
        return { vendors: [] };
      }

      // Extract URLs from top results (limit to top 8 for cost control)
      // Use specific URLs (not wildcards) to avoid consolidation issues
      // Extract API will use includeSubdomains to check related pages
      const extractUrls = webResults
        .slice(0, 8)
        .map((result: any) => result.url)
        .filter((url: string | undefined): url is string => Boolean(url));

      console.log(`Found ${extractUrls.length} vendor URLs to extract`);

      if (extractUrls.length === 0) {
        console.warn("No valid URLs found in search results");
        return { vendors: [] };
      }

      // Extract vendors in parallel with concurrency limit (3 at a time)
      // This avoids overwhelming the API while still being faster than sequential
      console.log(`Starting parallel extraction for ${extractUrls.length} URLs (concurrency limit: 3)...`);
      
      const vendors = await processUrlsInParallel(
        extractUrls,
        webResults.slice(0, extractUrls.length),
        specialty,
        tags,
        location,
        firecrawlApiKey,
        options?.onVendorExtracted,
        3 // Process 3 URLs concurrently
      );

      const extractedCount = vendors.filter(v => v.email || v.phone).length;
      const withEmail = vendors.filter(v => v.email).length;
      const withPhone = vendors.filter(v => v.phone).length;
      console.log(`Extracted ${vendors.length} vendors: ${extractedCount} with contact info (${withEmail} emails, ${withPhone} phones)`);
      
      return { vendors };
    },
  } as any);
}

