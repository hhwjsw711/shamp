/**
 * Tool for analyzing images using OpenAI Vision API
 */

"use node";

import { tool } from "ai";
import { z } from "zod";
import OpenAI from "openai";
import type { ActionCtx } from "../../../_generated/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const analyzeImageSchema = z.object({
  imageUrl: z.string().describe("URL of the image to analyze"),
});

type AnalyzeImageParams = z.infer<typeof analyzeImageSchema>;

export function createAnalyzeImageTool(ctx: ActionCtx) {
  return tool({
    description:
      "Analyze an image to identify equipment type, problem description, and visual tags",
    parameters: analyzeImageSchema,
    execute: async ({ imageUrl }: AnalyzeImageParams) => {
      // Fetch image and convert to base64
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString("base64");

      // Call OpenAI Vision API
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this maintenance issue image from a hospitality business (hotel or restaurant). 

Identify and describe:
1. Equipment type (e.g., HVAC unit, plumbing fixture, kitchen appliance, electrical outlet, etc.)
2. Problem description - Provide a DETAILED, CLEAR description of what's wrong in SIMPLE, PLAIN LANGUAGE. Describe what you see, what's broken, damaged, or not working properly. Be specific about the issue (e.g., "Water is leaking from the pipe connection", "The door handle is broken and hanging loose", "There's visible rust and corrosion on the metal surface"). Write this as if explaining to someone who isn't technical.
3. Visual tags - List relevant tags that describe the visual aspects of the problem (e.g., 'leak', 'damage', 'broken', 'rust', 'crack', 'missing', 'disconnected', etc.)

Return as JSON with these exact fields: equipmentType, problemDescription, visualTags.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });

      const analysis = JSON.parse(response.choices[0].message.content || "{}");

      return {
        equipmentType: analysis.equipmentType || "Unknown",
        problemDescription: analysis.problemDescription || "", // Detailed description in simple terms
        visualTags: analysis.visualTags || [],
      };
    },
  } as any);
}

