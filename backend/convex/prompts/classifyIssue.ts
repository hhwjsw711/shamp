/**
 * Prompt for classifying maintenance issues (used in classifyIssue tool)
 */
export function getClassifyIssuePrompt(
  description: string,
  existingUrgency?: "emergency" | "urgent" | "normal" | "low"
) {
  // Escape the description to handle quotes, apostrophes, and newlines safely
  const escapedDescription = description
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .trim()

  const urgencyGuidance = existingUrgency
    ? `\n\nIMPORTANT: The user has already set urgency to "${existingUrgency}". Only override this if your analysis clearly shows it's incorrect (e.g., user marked "low" but description indicates fire, flood, security breach, or guest safety issue). Otherwise, respect the user's urgency selection and return "${existingUrgency}".`
    : ''

  return `Classify this maintenance issue description from a hospitality business (hotel or restaurant): "${escapedDescription}"${urgencyGuidance}
        
        Return:
        - issueType: The type of equipment or issue (e.g., "HVAC", "Plumbing", "Electrical", "Kitchen Equipment", "Guest Room", "Dining Area")
        - tags: Array of relevant tags considering hospitality context (e.g., ["leak", "urgent", "kitchen", "restaurant", "hotel", "guest room"])
        - urgency: One of emergency (fire, flood, security, guest safety), urgent (guest-facing issues, operational disruption), normal (routine maintenance), low (non-critical, cosmetic issues) - considering impact on hospitality operations and guest experience${existingUrgency ? `. If user set "${existingUrgency}" and it seems reasonable, use that value.` : ''}`
}

