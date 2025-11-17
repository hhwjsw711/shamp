/**
 * Prompt for extracting vendor information from web pages (used in searchVendors tool)
 * 
 * This prompt is designed to extract critical vendor contact information from vendor websites.
 * The Extract API will check multiple pages and sections of each vendor site to find
 * contact information that may be on different pages (contact page, about page, footer, etc.)
 */
export const VENDOR_EXTRACTION_PROMPT = `Extract comprehensive vendor business information from this website. This is CRITICAL for contacting vendors, so be EXTREMELY thorough and check ALL pages and sections of the site.

🚨 ABSOLUTE PRIORITY - Contact Information (MANDATORY):
You MUST find both phone number and email address. These are non-negotiable requirements.

**Phone Number Extraction (REQUIRED):**
- Search EVERYWHERE on the website:
  * Homepage header and footer (most common location)
  * Dedicated "Contact" or "Contact Us" pages
  * "About Us" or "About" pages
  * "Get a Quote" or "Request Quote" pages
  * "Call Us" or "Call Now" sections/buttons
  * Navigation menus (often in header)
  * Footer sections (very common location)
  * Sidebar widgets
  * Business card sections
  * "Location" or "Locations" pages
  * "Service Areas" pages
  * Any forms or popups
  * Meta tags or structured data
- Look for phone numbers in various formats:
  * (732) 733-2541
  * 732-733-2541
  * 732.733.2541
  * +1-732-733-2541
  * 1-732-733-2541
  * (732) 733-2541 ext. 123
- Extract the PRIMARY/Main business phone number (not emergency-only lines if there's a main line)
- If multiple numbers exist, prefer the main business line over emergency/after-hours numbers
- Format: Extract exactly as displayed (preserve formatting)

**Email Address Extraction (REQUIRED):**
- Search EVERYWHERE on the website:
  * Footer sections (most common location - check every footer!)
  * Dedicated "Contact" or "Contact Us" pages
  * "Get in Touch" sections
  * "Email Us" links or buttons
  * Contact forms (often have email addresses nearby)
  * "About Us" pages
  * Header sections (sometimes in top bar)
  * Navigation menus
  * "Support" or "Customer Service" pages
  * Social media links (sometimes email is nearby)
  * Meta tags or structured data
- Look for business email addresses:
  * info@businessname.com
  * contact@businessname.com
  * sales@businessname.com
  * support@businessname.com
  * hello@businessname.com
  * service@businessname.com
- Prefer general business emails (info@, contact@) over personal emails
- Extract the PRIMARY business email address
- Format: Extract the full email address exactly as shown

REQUIRED FIELDS:
- **Business Name**: The official business name as displayed prominently on the website
- **Address**: Full business address including street, city, state, and zip code if available
- **Services**: List all services offered (e.g., ["HVAC Repair", "Plumbing", "Electrical", "24/7 Emergency Service"])

OPTIONAL BUT VALUABLE:
- **Rating**: Any customer ratings, reviews scores, or satisfaction ratings mentioned (0-5 scale)

CRITICAL EXTRACTION INSTRUCTIONS:
1. **Check ALL page sections**: Header, footer, sidebar, main content, navigation menus, popups, forms
2. **Navigate to multiple pages**: If contact info isn't on homepage, check /contact, /about, /locations, /contact-us pages
3. **Read footer carefully**: Footer sections often contain contact information - check every line
4. **Check HTML source**: Sometimes contact info is in page source even if not prominently displayed
5. **Look for clickable elements**: Phone numbers and emails are often in links (tel: or mailto:)
6. **Be persistent**: If phone/email isn't immediately visible, dig deeper - it's almost always somewhere on the site
7. **Extract PRIMARY contact info**: If multiple phone numbers or emails exist, extract the main business contact (not emergency-only or personal contacts)
8. **Preserve formatting**: Extract phone numbers and emails exactly as they appear on the site

REMEMBER: Phone number and email address are MANDATORY. If you cannot find them after thoroughly checking all pages and sections, you must still attempt to extract them from any available source, even if partially visible or in structured data.

The extracted information will be used to contact vendors for maintenance work at hospitality businesses (hotels, restaurants).`

