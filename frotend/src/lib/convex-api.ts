/**
 * Convex API reference (untyped)
 *
 * This app is structured as a `backend/` Convex project and a separate `frotend/`.
 * Importing the backend's generated `convex/_generated/api.d.ts` pulls in and
 * typechecks the entire backend, which breaks frontend deploys.
 *
 * We intentionally use Convex's `anyApi` here to avoid coupling the frontend
 * TypeScript build to backend source. Runtime behavior is correct; type-safety
 * for function references is relaxed.
 */

import { anyApi } from 'convex/server'

export const api = anyApi

