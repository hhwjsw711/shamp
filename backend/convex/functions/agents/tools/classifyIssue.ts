/**
 * Tool for classifying issues from text descriptions
 */

"use node";

import { generateObject, tool } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { getClassifyIssuePrompt } from "../../../prompts/classifyIssue";

const classifyIssueSchema = z.object({
  description: z.string().describe("Issue description text"),
  existingUrgency: z.enum(["emergency", "urgent", "normal", "low"]).optional().describe("Existing urgency level if already set by user (only classify if this is missing or clearly incorrect)"),
});

type ClassifyIssueParams = z.infer<typeof classifyIssueSchema>;

export function createClassifyIssueTool() {
  return tool({
    description:
      "Classify issue type, generate tags, and predict urgency from description text. If existingUrgency is provided, only override it if the analysis clearly shows it's incorrect (e.g., user marked 'low' but description indicates fire/flood).",
    inputSchema: classifyIssueSchema,
    execute: async ({ description, existingUrgency }: ClassifyIssueParams) => {
      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: z.object({
          issueType: z.string().describe("Type of maintenance issue"),
          tags: z.array(z.string()).describe("Relevant tags for the issue"),
          urgency: z
            .enum(["emergency", "urgent", "normal", "low"])
            .describe(
              existingUrgency
                ? `Urgency level. User has set it to "${existingUrgency}". Only override if analysis clearly shows it's incorrect (e.g., marked "low" but description indicates fire/flood/security issue). Otherwise, use "${existingUrgency}".`
                : "Urgency level: emergency (fire, flood, security, guest safety), urgent (guest-facing, operational disruption), normal (routine maintenance), low (non-critical, cosmetic)"
            ),
        }),
        prompt: getClassifyIssuePrompt(description, existingUrgency),
      });

      return object;
    },
  } as any);
}

