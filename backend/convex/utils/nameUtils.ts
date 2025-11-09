/**
 * Name capitalization utility
 * Capitalizes names properly (e.g., "john doe" -> "John Doe")
 */

/**
 * Sanitize name by removing unwanted characters
 * Removes brackets, quotes (but preserves apostrophes in names), and extra whitespace
 * @param name - Name to sanitize
 * @returns Sanitized name
 */
export function sanitizeName(name: string): string {
  if (!name || name.trim().length === 0) {
    return name;
  }

  return name
    // Remove brackets [ ]
    .replace(/[\[\]]/g, '')
    // Remove all types of quotes: straight ", curly " ", and other Unicode quotes
    // Using a more comprehensive regex to catch all quote variations
    .replace(/[""''„‟«»‹›‚‛]/g, '')
    // Remove any remaining non-alphanumeric characters except spaces, hyphens, and apostrophes
    // This is a safety net to catch any other invalid characters
    .replace(/[^a-zA-Z0-9\s'-]/g, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Capitalize a name string
 * Handles multiple words, hyphens, and apostrophes
 * @param name - Name to capitalize
 * @returns Capitalized name
 */
export function capitalizeName(name: string): string {
  if (!name || name.trim().length === 0) {
    return name;
  }

  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      // Handle hyphenated names (e.g., "mary-jane" -> "Mary-Jane")
      if (word.includes("-")) {
        return word
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join("-");
      }
      // Handle apostrophes (e.g., "o'connor" -> "O'Connor")
      if (word.includes("'")) {
        return word
          .split("'")
          .map((part, index) => {
            if (index === 0) {
              return part.charAt(0).toUpperCase() + part.slice(1);
            }
            return part;
          })
          .join("'");
      }
      // Regular word capitalization
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Format name from Google OAuth or email/password
 * Sanitizes unwanted characters (brackets, quotes) and capitalizes properly
 * Handles null/undefined and empty strings
 * @param name - Name to format
 * @returns Formatted name or null
 */
export function formatName(name: string | undefined | null): string | null {
  if (!name || name.trim().length === 0) {
    return null;
  }
  
  // First sanitize (remove brackets, quotes, extra whitespace)
  const sanitized = sanitizeName(name.trim());
  
  // Then capitalize
  return capitalizeName(sanitized);
}

