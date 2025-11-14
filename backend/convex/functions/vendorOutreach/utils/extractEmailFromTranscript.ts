/**
 * Extract Email from Transcript
 * Parse vendor call transcripts to find verified/better email addresses
 */

export interface ExtractedEmailInfo {
  email: string | null;
  contactName: string | null;
  department: string | null;
  confidence: "high" | "medium" | "low";
}

/**
 * Extract email address and contact information from call transcript
 */
export function extractEmailFromTranscript(
  transcript: string
): ExtractedEmailInfo {
  if (!transcript || transcript.trim().length === 0) {
    return {
      email: null,
      contactName: null,
      department: null,
      confidence: "low",
    };
  }

  // Email regex pattern
  const emailPattern =
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;

  // Find all emails mentioned in transcript
  const emails = transcript.match(emailPattern) || [];
  const uniqueEmails = [...new Set(emails.map((e) => e.toLowerCase()))];

  if (uniqueEmails.length === 0) {
    return {
      email: null,
      contactName: null,
      department: null,
      confidence: "low",
    };
  }

  // Look for better emails (not info@, not generic)
  const betterEmails = uniqueEmails.filter(
    (e) =>
      !e.startsWith("info@") &&
      (e.includes("sales") ||
        e.includes("estimate") ||
        e.includes("quote") ||
        e.includes("service") ||
        e.includes("contact") ||
        e.includes("@") && !e.includes("info"))
  );

  // Extract contact name patterns
  // Look for: "speak with [Name]", "contact [Name]", "name is [Name]", etc.
  const namePatterns = [
    /(?:speak with|contact|talk to|name is|call|email)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:it's|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:you can reach|reach out to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  ];

  let contactName: string | null = null;
  for (const pattern of namePatterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      contactName = match[1].trim();
      break;
    }
  }

  // Extract department
  const deptPatterns = [
    /(sales|estimates?|quotes?|service|operations?|customer\s+service)\s+(?:department|team|person|email)/i,
    /(?:in|from)\s+(?:the\s+)?(sales|estimates?|quotes?|service|operations?)\s+(?:department|team)/i,
  ];

  let department: string | null = null;
  for (const pattern of deptPatterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      department = match[1].toLowerCase();
      break;
    }
  }

  // Determine confidence and select best email
  let selectedEmail: string | null = null;
  let confidence: "high" | "medium" | "low" = "low";

  if (betterEmails.length > 0) {
    // High confidence: found better email (not info@)
    selectedEmail = betterEmails[0];
    confidence = "high";
  } else if (uniqueEmails.length > 0) {
    // Medium confidence: found email but it's generic
    selectedEmail = uniqueEmails[0];
    confidence = "medium";
  }

  return {
    email: selectedEmail,
    contactName,
    department,
    confidence,
  };
}

