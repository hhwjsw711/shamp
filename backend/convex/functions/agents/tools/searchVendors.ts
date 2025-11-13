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

export function createSearchVendorsTool(options?: {
  onUrlsFound?: (urls: Array<string>) => Promise<void>;
  onVendorExtracted?: (vendor: any) => Promise<void>;
}) {
  return tool({
    description:
      "Search for local vendors using Firecrawl Search API to discover URLs. URLs will be extracted in background jobs to avoid timeouts.",
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
        return { vendors: [], urls: [] };
      }

      // Notify callback that URLs were found (for scheduling extraction jobs)
      if (options?.onUrlsFound) {
        await options.onUrlsFound(extractUrls);
      }

      // Return URLs and basic vendor info from search results
      // Actual extraction will happen in background jobs
      const vendors = webResults.slice(0, extractUrls.length).map((result: any, index: number) => ({
        businessName: result.title || "Unknown",
        email: undefined, // Will be filled by extraction job
        phone: undefined, // Will be filled by extraction job
        specialty: specialty || tags[0] || "General",
        address: result.metadata?.address || location,
        rating: result.metadata?.rating || undefined,
        url: extractUrls[index],
        description: result.description,
        position: result.position || index + 1,
        services: [],
      }));

      console.log(`Returning ${vendors.length} vendor URLs for background extraction`);
      return { vendors, urls: extractUrls };
    },
  } as any);
}

