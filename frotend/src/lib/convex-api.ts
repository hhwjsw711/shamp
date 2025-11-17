/**
 * Convex API Types Reference
 * 
 * This file provides a type-safe way to reference Convex API functions
 * when the backend is in a separate directory.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Run `npx convex dev` in the backend directory (shamp/backend) to generate types
 * 2. The _generated folder will be created in shamp/backend/convex/
 * 3. Import from this file: `import { api } from '@/lib/convex-api'`
 * 4. Use in components: `useQuery(api.functions.tickets.queries.list, { userId })`
 * 
 * IMPORTANT: Make sure Convex types are generated before using this file.
 * The path assumes backend is at: ../../backend/convex/_generated/api
 * Adjust the path if your project structure is different.
 */

// Re-export Convex API types from backend
// Path: from frotend/src/lib/ to backend/convex/_generated/api
export { api } from '../../../backend/convex/_generated/api'

