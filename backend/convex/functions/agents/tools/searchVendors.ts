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
  onVendorExtracted?: (vendor: any) => Promise<void>;
}) {
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
      // Use specific URLs (not wildcards) to avoid consolidation issues
      // Extract API will use includeSubdomains to check related pages
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
      // Extract each URL individually to avoid consolidation issues
      // According to Firecrawl docs: https://docs.firecrawl.dev/features/extract
      try {
        console.log(`Starting extraction for ${extractUrls.length} URLs (extracting individually to avoid consolidation)...`);
        
        const extractedVendors: any[] = [];
        
        // Extract each URL individually to ensure we get per-URL results
        for (let i = 0; i < extractUrls.length; i++) {
          const url = extractUrls[i];
          console.log(`Extracting vendor ${i + 1}/${extractUrls.length}: ${url}`);
          
          try {
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
                  urls: [url], // Single URL array
                  prompt: VENDOR_EXTRACTION_PROMPT,
                  schema: {
                    type: "object",
                    properties: {
                      businessName: { 
                        type: "string",
                        description: "The official business name as displayed prominently on the website"
                      },
                      email: { 
                        type: "string",
                        description: "Primary business email address (MANDATORY - must check footer, header, contact pages, all sections)"
                      },
                      phone: { 
                        type: "string",
                        description: "Primary business phone number (MANDATORY - must check footer, header, contact pages, all sections)"
                      },
                      address: { 
                        type: "string",
                        description: "Full business address including street, city, state, and zip code"
                      },
                      services: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of all services offered by the vendor"
                      },
                      rating: { 
                        type: "number",
                        description: "Customer ratings, review scores, or satisfaction ratings (0-5 scale)"
                      },
                    },
                    required: ["businessName", "email", "phone"],
                  },
                  // Enable web search to find additional contact information if not on main site
                  enableWebSearch: true,
                  // Include subdomains to check related pages (e.g., contact.example.com)
                  includeSubdomains: true,
                  // Scrape options to ensure we get footer/header content where contact info often is
                  scrapeOptions: {
                    // Don't limit to main content only - we need footer/header sections
                    onlyMainContent: false,
                    // Include all content to find contact info in any section
                    formats: ["markdown", "html"],
                    // Wait a bit for dynamic content to load
                    waitFor: 1000,
                  },
                }),
              }
            );

            if (!extractResponse.ok) {
              const errorText = await extractResponse.text();
              console.error(
                `Firecrawl Extract API error for ${url}: ${extractResponse.statusText} - ${errorText}`
              );
              // Continue to next URL instead of failing completely
              extractedVendors.push(null);
              continue;
            }

            const extractJobResponse = await extractResponse.json();
            
            // Check if we got a job ID (async job) or immediate results
            let extractData: any;
            
            if (extractJobResponse.id) {
              // Job-based extraction - need to poll for completion
              const jobId = extractJobResponse.id;
              const pollInterval = 2000; // Poll every 2 seconds
              
              // Poll for job completion - continue until job completes, fails, or is cancelled
              let attempt = 0;
              while (true) {
                attempt++;
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                
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
                  extractedVendors.push(null);
                  break;
                }

                const statusData = await statusResponse.json();
                
                // Log status every 5 attempts to avoid spam
                if (attempt % 5 === 0 || statusData.status !== "processing") {
                  console.log(`Extraction job status for ${url} (attempt ${attempt}):`, statusData.status);
                }

                if (statusData.status === "completed") {
                  extractData = statusData;
                  console.log(`Extraction completed for ${url} after ${attempt} attempts (~${attempt * pollInterval / 1000} seconds)`);
                  break;
                } else if (statusData.status === "failed" || statusData.status === "cancelled") {
                  console.error(`Extraction job ${statusData.status} for ${url}:`, statusData.error);
                  extractedVendors.push(null);
                  break;
                }
                // Continue polling if status is "processing"
              }
            } else {
              // Immediate results (shouldn't happen for single URL, but handle it)
              extractData = extractJobResponse;
            }

            // Process extracted data for single URL
            if (extractData && extractData.success && extractData.data) {
              // For single URL, data should be a single object (not array)
              const extracted = typeof extractData.data === 'object' && !Array.isArray(extractData.data)
                ? extractData.data
                : (Array.isArray(extractData.data) ? extractData.data[0] : null);
              
              if (extracted) {
                extractedVendors.push(extracted);
                console.log(`✓ Successfully extracted data for ${url}`);
                
                // Save vendor immediately after extraction (if callback provided)
                if (options?.onVendorExtracted && webResults[i]) {
                  try {
                    const searchResult = webResults[i];
                    const vendor = {
                      businessName:
                        extracted.businessName || searchResult?.title || "Unknown",
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
                      position: searchResult?.position || i + 1,
                      services: Array.isArray(extracted.services) ? extracted.services : [],
                    };
                    
                    // Call callback to save vendor incrementally
                    await options.onVendorExtracted(vendor);
                    console.log(`✓ Saved vendor ${vendor.businessName} to database incrementally`);
                  } catch (saveError) {
                    console.error(`Error saving vendor incrementally:`, saveError);
                    // Continue extraction even if save fails
                  }
                }
              } else {
                console.warn(`⚠ No data extracted for ${url}`);
                extractedVendors.push(null);
              }
            } else {
              console.warn(`⚠ No extraction data returned for ${url}`);
              extractedVendors.push(null);
            }
          } catch (error) {
            console.error(`Error extracting ${url}:`, error);
            extractedVendors.push(null);
          }
        }

        console.log(`Extracted ${extractedVendors.filter(v => v !== null).length} vendor result(s) from ${extractUrls.length} URLs`);

        // Map extracted data to vendor format, preserving search ranking info
        const vendors: any[] = [];
        
        // Process each URL and match with extracted data
        for (let i = 0; i < extractUrls.length; i++) {
          const searchResult = webResults[i];
          const url = extractUrls[i];
          const extracted = extractedVendors[i] || null;
          
          if (extracted && typeof extracted === 'object') {
            // Use extracted data with fallback to search result
            // Prioritize extracted contact info (email, phone) as these are critical
            const vendor = {
              businessName:
                extracted.businessName || searchResult?.title || "Unknown",
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
              position: searchResult?.position || i + 1,
              services: Array.isArray(extracted.services) ? extracted.services : [],
            };
            
            vendors.push(vendor);
            
            // Log if we successfully extracted contact info
            if (vendor.email || vendor.phone) {
              console.log(`✓ Extracted contact info for ${vendor.businessName}: email=${vendor.email ? 'yes' : 'no'}, phone=${vendor.phone ? 'yes' : 'no'}`);
            } else {
              console.warn(`⚠ No contact info extracted for ${vendor.businessName} from ${url}`);
            }
          } else {
            // Fallback to search result if extraction didn't return data for this URL
            vendors.push({
              businessName: searchResult?.title || "Unknown",
              email: undefined,
              phone: undefined,
              specialty: specialty || tags[0] || "General",
              address: location,
              rating: undefined,
              url: url,
              description: searchResult?.description,
              position: searchResult?.position || i + 1,
              services: [],
            });
            console.warn(`⚠ No extraction data for ${searchResult?.title || url}, using search result only`);
          }
        }

        const extractedCount = vendors.filter(v => v.email || v.phone).length;
        const withEmail = vendors.filter(v => v.email).length;
        const withPhone = vendors.filter(v => v.phone).length;
        console.log(`Returning ${vendors.length} vendors: ${extractedCount} with contact info (${withEmail} emails, ${withPhone} phones)`);
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

