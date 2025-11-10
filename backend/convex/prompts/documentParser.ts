/**
 * Prompt for parsing quote data from extracted document text
 */
export function getDocumentQuoteParsePrompt(params: {
  extractedText: string
  ticketDescription: string
  issueType: string | undefined
  location: string | undefined
  vendorBusinessName: string
}) {
  const { extractedText, ticketDescription, issueType, location, vendorBusinessName } = params

  return `You are parsing a vendor quote document. Extract quote information from the following text.

Document Text:
${extractedText}

Ticket Context:
- Issue: ${ticketDescription}
- Issue Type: ${issueType || 'Unknown'}
- Location: ${location || 'Not specified'}
- Vendor: ${vendorBusinessName}

Extract the following information:
1. **Price**: Look for any mention of price, cost, quote, estimate, fee, charge, total, amount, etc. Convert to smallest currency unit (e.g., $500 = 50000 cents for USD)
2. **Currency**: Identify the currency (USD, EUR, GBP, etc.). Default to USD if not specified.
3. **Delivery Time**: Look for completion time, delivery time, estimated time, duration, etc. Convert to hours (e.g., "2 days" = 48 hours, "1 week" = 168 hours)
4. **Ratings**: If the vendor mentions ratings, reviews, or satisfaction scores, extract them (0-5 scale)
5. **Notes**: Any additional information, conditions, or requirements
6. **Declining**: Determine if the vendor is declining the work or unable to take it on

Return a JSON object with these fields.`
}

