/**
 * Extract Email from Transcript
 * Parse vendor call transcripts to find verified/better email addresses
 */

export interface ExtractedEmailInfo {
  email: string | null;
  confidence: "high" | "medium" | "low";
}

/**
 * Extract email address from call transcript
 * Returns the best email found (preferring non-generic emails like sales@ over info@)
 */
export function extractEmailFromTranscript(
  transcript: string
): ExtractedEmailInfo {
  if (!transcript || transcript.trim().length === 0) {
    return {
      email: null,
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
        (e.includes("@") && !e.includes("info")))
  );

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
    confidence,
  };
}

