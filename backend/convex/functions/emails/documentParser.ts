/**
 * Document parser for extracting quote data from PDFs and images
 * Uses OpenAI Vision API for OCR and PDF text extraction
 */

"use node";

import { action } from "../../_generated/server";
import { v } from "convex/values";
import OpenAI from "openai";
import { getDocumentQuoteParsePrompt } from "../../prompts/documentParser";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract text from PDF or image using OpenAI Vision API
 */
export const extractTextFromDocument = action({
  args: {
    fileUrl: v.string(), // URL to the document (PDF or image)
    filename: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    try {
      // Fetch the document
      const response = await fetch(args.fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      
      // Determine MIME type
      let mimeType = args.contentType;
      if (!mimeType) {
        const ext = args.filename.split(".").pop()?.toLowerCase();
        if (ext === "pdf") {
          mimeType = "application/pdf";
        } else if (["jpg", "jpeg"].includes(ext || "")) {
          mimeType = "image/jpeg";
        } else if (ext === "png") {
          mimeType = "image/png";
        } else {
          mimeType = "application/octet-stream";
        }
      }

      // Use OpenAI Vision API to extract text
      // For PDFs, OpenAI can extract text directly
      // For images, it performs OCR
      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o", // GPT-4o supports both PDFs and images
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text from this document. Include any numbers, prices, dates, and delivery times. Preserve the structure and formatting as much as possible.",
              },
              {
                type: mimeType.startsWith("image/") ? "image_url" : "image_url", // OpenAI handles PDFs via image_url too
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 4000,
      });

      const extractedText = visionResponse.choices[0]?.message?.content || "";
      
      if (!extractedText) {
        throw new Error("No text extracted from document");
      }

      return extractedText;
    } catch (error) {
      console.error("Error extracting text from document:", error);
      throw error;
    }
  },
});

/**
 * Parse quote data from extracted text using OpenAI
 */
export const parseQuoteFromText = action({
  args: {
    extractedText: v.string(),
    ticketDescription: v.string(),
    issueType: v.optional(v.string()),
    location: v.optional(v.string()),
    vendorBusinessName: v.string(),
  },
  handler: async (ctx, args): Promise<{
    hasQuote: boolean;
    price?: number;
    currency: string;
    estimatedDeliveryTime?: number;
    scheduledDate?: number;
    fixDuration?: number;
    ratings?: number;
    notes?: string;
    isDeclining: boolean;
    declineReason?: string;
  }> => {
    const prompt = getDocumentQuoteParsePrompt({
      extractedText: args.extractedText,
      ticketDescription: args.ticketDescription,
      issueType: args.issueType,
      location: args.location,
      vendorBusinessName: args.vendorBusinessName,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting structured data from vendor quote documents. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    try {
      const parsed = JSON.parse(content);
      
      return {
        hasQuote: parsed.hasQuote ?? false,
        price: parsed.price,
        currency: parsed.currency || "USD",
        estimatedDeliveryTime: parsed.estimatedDeliveryTime,
        scheduledDate: parsed.scheduledDate,
        fixDuration: parsed.fixDuration,
        ratings: parsed.ratings,
        notes: parsed.notes,
        isDeclining: parsed.isDeclining ?? false,
        declineReason: parsed.declineReason,
      };
    } catch (error) {
      console.error("Error parsing quote data:", error);
      throw new Error("Failed to parse quote data from document");
    }
  },
});

