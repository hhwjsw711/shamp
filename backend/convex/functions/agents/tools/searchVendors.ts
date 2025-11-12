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

export function createSearchVendorsTool() {
  return tool({
    description:
      "Search for local vendors using Firecrawl Search API to discover URLs, then use Extract API to get accurate vendor information from web pages",
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
      const extractUrls = webResults
        .slice(0, 8)
        .map((result: any) => result.url)
        .filter((url: string | undefined): url is string => Boolean(url));

      console.log(`Extracting vendor info from ${extractUrls.length} URLs`);

      if (extractUrls.length === 0) {
        console.warn("No valid URLs found in search results");
        return { vendors: [] };
      }

      // Use Firecrawl Extract API to get accurate vendor information from web pages
      try {
        const extractResponse = await fetch(
          "https://api.firecrawl.dev/v2/extract",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${firecrawlApiKey}`,
            },
            body: JSON.stringify({
              urls: extractUrls,
              prompt: VENDOR_EXTRACTION_PROMPT,
              schema: {
                type: "object",
                properties: {
                  businessName: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  address: { type: "string" },
                  services: {
                    type: "array",
                    items: { type: "string" },
                  },
                  rating: { type: "number" },
                },
              },
            }),
          }
        );

        if (!extractResponse.ok) {
          const errorText = await extractResponse.text();
          console.error(
            `Firecrawl Extract API error: ${extractResponse.statusText} - ${errorText}`
          );
          return { vendors: [] };
        }

        const extractData = await extractResponse.json();

        console.log("Firecrawl Extract API response:", JSON.stringify(extractData, null, 2));

        // Handle different response structures
        // API v2 might return: { data: [...] } or { data: { ... } } or just the array
        let extractedVendors: any[] = [];
        
        if (Array.isArray(extractData.data)) {
          extractedVendors = extractData.data;
        } else if (extractData.data && typeof extractData.data === 'object') {
          // If data is a single object, wrap it in an array
          extractedVendors = [extractData.data];
        } else if (Array.isArray(extractData)) {
          // Sometimes the response might be the array directly
          extractedVendors = extractData;
        } else if (extractData && typeof extractData === 'object' && !extractData.data) {
          // Single object response
          extractedVendors = [extractData];
        }

        console.log(`Extracted ${extractedVendors.length} vendors from Extract API`);

        // Map extracted data to vendor format, preserving search ranking info
        const vendors: any[] = [];
        
        // Process extracted vendors
        for (let i = 0; i < extractUrls.length; i++) {
          const searchResult = webResults[i];
          const extracted = extractedVendors[i];
          
          if (extracted) {
            // Use extracted data with fallback to search result
            vendors.push({
              businessName:
                extracted.businessName || searchResult?.title || "Unknown",
              email: extracted.email,
              phone: extracted.phone,
              specialty: specialty || tags[0] || "General",
              address:
                extracted.address ||
                searchResult?.metadata?.address ||
                location,
              rating: extracted.rating || searchResult?.metadata?.rating,
              url: extractUrls[i],
              description: searchResult?.description,
              position: searchResult?.position || i + 1,
              services: extracted.services || [],
            });
          } else {
            // Fallback to search result if extraction didn't return data for this URL
            vendors.push({
              businessName: searchResult?.title || "Unknown",
              email: undefined,
              phone: undefined,
              specialty: specialty || tags[0] || "General",
              address: location,
              rating: undefined,
              url: extractUrls[i],
              description: searchResult?.description,
              position: searchResult?.position || i + 1,
              services: [],
            });
          }
        }

        console.log(`Returning ${vendors.length} vendors (${extractedVendors.length} from extraction, ${vendors.length - extractedVendors.length} from search results)`);
        return { vendors };
      } catch (error) {
        console.error("Firecrawl Extract API error:", error);
        // Fallback: return vendors from search results if extraction fails completely
        console.log("Falling back to search results due to extraction error");
        const vendorsFromSearch = webResults.slice(0, extractUrls.length).map((result: any, index: number) => ({
          businessName: result.title || "Unknown",
          email: undefined,
          phone: undefined,
          specialty: specialty || tags[0] || "General",
          address: location,
          rating: undefined,
          url: extractUrls[index],
          description: result.description,
          position: result.position || index + 1,
          services: [],
        }));
        return { vendors: vendorsFromSearch };
      }
    },
  } as any);
}

