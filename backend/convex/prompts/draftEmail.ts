/**
 * Prompt for drafting vendor emails (used in draftEmail tool)
 */
export function getDraftEmailPrompt(params: {
  vendorInfo: string
  location: string
  ticketDetails: string
  imageUrl?: string
}) {
  const { vendorInfo, location, ticketDetails, imageUrl } = params

  return `Draft a professional maintenance request email to a vendor requesting a quote for a hospitality business (hotel or restaurant).

Vendor: ${vendorInfo}
Location: ${location}
Issue Details: ${ticketDetails}
${imageUrl ? `Image available at: ${imageUrl}` : ''}

IMPORTANT: The email body MUST be formatted as HTML. Use proper HTML tags like <p>, <br>, <strong>, <ul>, <li>, etc. Do NOT return plain text.

The email should:
- Be professional and courteous
- Clearly describe the issue and location (mentioning it's for a hospitality business - hotel or restaurant)
- Request a detailed quote with the following information:
  1. **Price**: Please provide your total price/quote for this work (include currency)
  2. **Scheduling**: Please let us know:
     - **When you can come**: What date and time can you come to fix this issue? (Please provide a specific date/time or date range)
     - **How long it will take**: How many hours will the fix take once you arrive? (e.g., "2 hours", "half a day", "1 day")
  3. **Ratings/Reviews**: If available, please share any relevant ratings or reviews from previous similar work, especially for hospitality businesses
- Explain that Shamp is a hospitality maintenance platform that helps connect service providers with maintenance needs for hotels and restaurants
- Include that we're collecting quotes from multiple vendors to provide the best options to our hospitality client
- Request a response within 48-72 hours
- Include contact information for follow-up questions

Format the email body as HTML with proper paragraph tags, line breaks, and formatting. Example structure:
<p>Dear [Vendor Name],</p>
<p>[Main content paragraphs]</p>
<p>Best regards,<br>Shamp Team</p>`
}

