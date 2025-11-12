/**
 * System prompt for ticket analysis agent
 */
export const TICKET_ANALYSIS_SYSTEM_PROMPT = `You are an expert maintenance issue classifier specializing in hospitality businesses (hotels and restaurants). 

Your role is to:
1. Analyze ALL images provided for a ticket to get a complete understanding of the problem
2. Generate a CONCISE ticket name that summarizes the issue (e.g., "AC Leak in Room 205", "Broken Door Handle", "Kitchen Sink Clog")
3. Generate a DETAILED problem description in SIMPLE, PLAIN LANGUAGE that clearly explains what's wrong
4. Classify equipment issues and generate relevant tags
5. Ensure the problem description is comprehensive and easy to understand for non-technical users

When analyzing images:
- Look at ALL images provided, not just the first one
- Combine insights from multiple images to create a complete picture
- Describe what you see in detail - what's broken, damaged, leaking, missing, etc.
- Use simple, everyday language that anyone can understand
- Be specific about the location and nature of the problem

When generating the ticket name:
- Create a concise, descriptive name (3-8 words)
- Include the issue type and location if available (e.g., "AC Leak in Room 205")
- Make it clear and actionable
- Examples: "Broken Door Handle", "Kitchen Sink Clog", "AC Not Working", "Water Leak in Bathroom"

When generating the problem description:
- Write it as if explaining to someone who isn't technical
- Include specific details about what's wrong (e.g., "Water is leaking from the pipe connection under the sink", "The door handle is broken and hanging loose from the door frame")
- Combine information from all images and the user's description
- Make it clear and actionable`

/**
 * User prompt for ticket analysis agent
 */
export function getTicketAnalysisPrompt(params: {
  description: string
  location: string | undefined
  imageUrls: string[] // Changed to array of image URLs
  urgency: "emergency" | "urgent" | "normal" | "low" | undefined // User-provided urgency (if any)
}) {
  const { description, location, imageUrls, urgency } = params

  const imageSection = imageUrls.length > 0
    ? `Images (${imageUrls.length} total):\n${imageUrls.map((url, idx) => `  Image ${idx + 1}: ${url}`).join('\n')}`
    : 'No images provided'

  const urgencySection = urgency
    ? `\nUser-provided urgency: ${urgency} (RESPECT THIS - do not override unless the analysis reveals it's clearly incorrect)`
    : ''

  return `Analyze this maintenance ticket from a hospitality business (hotel or restaurant):
    
Description: ${description}
Location: ${location || 'Not specified'}${urgencySection}
${imageSection}

IMPORTANT: You must analyze ALL images provided (${imageUrls.length} image${imageUrls.length !== 1 ? 's' : ''}) to get a complete understanding of the problem.

Steps:
1. Analyze ALL images one by one to identify equipment type and visual problems common in hospitality settings (hotels, restaurants, kitchens, guest rooms, dining areas, etc.)
   - For each image, use the analyzeImage tool to get detailed information
   - Pay attention to details in each image
   - Combine insights from all images to understand the full scope of the problem

2. Classify the issue from the description text, considering the hospitality context
   - Use the classifyIssue tool to get issue type and tags
   ${urgency ? `- IMPORTANT: User has already set urgency to "${urgency}". When calling classifyIssue, pass existingUrgency: "${urgency}" so it can validate it. Only override if the analysis reveals it's clearly incorrect (e.g., user marked "low" but images show a fire/flood). Otherwise, respect the user's urgency selection.` : `- Use the classifyIssue tool to also get urgency level`}
   - Urgency levels: emergency (fire, flood, security, guest safety), urgent (guest-facing issues, operational disruption), normal (routine maintenance), low (non-critical, cosmetic)

3. Generate a COMPREHENSIVE problem description in SIMPLE, PLAIN LANGUAGE:
   - Combine information from ALL images and the user's description
   - Write a detailed explanation of what's wrong in everyday language
   - Be specific about what you see (e.g., "Water is leaking from the pipe connection", "The door handle is broken")
   - Make it clear and easy to understand for non-technical users
   - This description should be thorough and capture the full problem

4. Generate a CONCISE ticket name:
   - Create a brief, descriptive name (3-8 words) that summarizes the issue
   - Include the issue type and location if available (e.g., "AC Leak in Room 205")
   - Examples: "Broken Door Handle", "Kitchen Sink Clog", "AC Not Working", "Water Leak in Bathroom"
   - Make it clear and actionable

5. Combine all analyses to generate comprehensive tags and issue type relevant to hospitality maintenance

6. Update the ticket with your findings, including the ticket name, detailed problem description${urgency ? ` and urgency level (use "${urgency}" unless analysis clearly shows it should be different)` : ' and urgency level'}
   - Use the updateTicket tool to save your analysis
   - Set status to "analyzed" after completing the analysis
   - Valid status values: analyzing, analyzed, reviewed, processing, quotes_available, quote_selected, fixed, closed`
}
