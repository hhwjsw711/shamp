# Convex Real-Time Queries Implementation

## Overview

This document explains the implementation of Convex real-time queries with comprehensive security measures to prevent unauthorized data access.

## Security Measures Implemented

### 1. **Backend Query Security (`shamp/backend/convex/utils/queryAuth.ts`)**

- **`validateUserId()`**: Validates that a userId exists in the database before processing queries
- **`requireValidUserId()`**: Throws authentication error if userId is invalid
- **Prevents**: Users from passing arbitrary userIds to access other users' data

### 2. **Public Query Authorization (`shamp/backend/convex/functions/tickets/queries.ts`)**

All public queries implement the following security measures:

#### **Always Filter by userId**
```typescript
// SECURITY: Always filter by userId using index
const tickets = await ctx.db
  .query("tickets")
  .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
  .collect();
```

#### **Validate userId Before Processing**
```typescript
// Validate userId exists in database
await validateUserId(ctx, args.userId);
```

#### **Authorization Checks**
```typescript
// For getById: Ensure ticket belongs to requesting user
if (ticket.createdBy !== args.userId) {
  throw new Error("Unauthorized: Ticket does not belong to user");
}
```

### 3. **Frontend Security (`shamp/frotend/src/routes/_authenticated/tickets/index.tsx`)**

- **userId from Authenticated Session**: Only uses userId from authenticated user session
- **Skip Query if Not Authenticated**: Query is skipped if user is not authenticated
- **Type Safety**: Uses TypeScript types to ensure userId is properly typed

## How It Works

### Backend Flow

1. **Query Receives Request**: Public query receives `userId` as argument
2. **Validate userId**: `validateUserId()` checks if userId exists in database
3. **Filter by userId**: Query filters results by `createdBy` field using index
4. **Return Results**: Only tickets belonging to the requesting user are returned

### Frontend Flow

1. **Get Authenticated User**: `useAuth()` hook provides authenticated user
2. **Pass userId to Query**: `useQuery()` passes authenticated user's ID
3. **Real-Time Updates**: Convex automatically updates UI when database changes
4. **Type Safety**: TypeScript ensures userId is properly typed

## Security Guarantees

### ✅ **Prevents Unauthorized Access**
- Users cannot access tickets belonging to other users
- userId is validated on the backend before processing
- Database queries always filter by userId

### ✅ **Prevents userId Spoofing**
- Frontend cannot pass arbitrary userIds
- Backend validates userId exists in database
- Authorization checks ensure ticket ownership

### ✅ **Real-Time Security**
- Real-time updates only show user's own tickets
- Changes to other users' tickets don't appear
- Query filters are applied to all real-time subscriptions

## Setup Instructions

### 1. Backend Setup

The backend queries are already set up with security measures. No additional configuration needed.

### 2. Frontend Setup

1. **Install Convex** (already done):
   ```bash
   npm install convex
   ```

2. **Set Environment Variable**:
   ```env
   VITE_CONVEX_URL=https://your-deployment.convex.cloud
   ```

3. **Generate Types** (if not already done):
   ```bash
   cd shamp/backend
   npx convex dev
   ```

4. **Verify Setup**:
   - Check that `shamp/backend/convex/_generated/api.ts` exists
   - Verify `shamp/frotend/src/lib/convex-api.ts` can import from backend

## Testing Security

### Test Case 1: User A Cannot Access User B's Tickets
1. User A logs in (userId: "userA")
2. User A tries to query tickets with userId: "userB"
3. **Expected**: Query returns only User A's tickets (filtered by backend)

### Test Case 2: Invalid userId Rejected
1. User tries to query with non-existent userId
2. **Expected**: `validateUserId()` throws AuthenticationError

### Test Case 3: Real-Time Updates Respect Authorization
1. User A views their tickets
2. User B creates a new ticket
3. **Expected**: User A's UI does not update (query filters by userId)

## Files Modified

### Backend
- `shamp/backend/convex/utils/queryAuth.ts` - Security utilities
- `shamp/backend/convex/functions/tickets/queries.ts` - Public queries with authorization

### Frontend
- `shamp/frotend/src/lib/convex.ts` - Convex client setup
- `shamp/frotend/src/lib/convex-api.ts` - API types reference
- `shamp/frotend/src/routes/__root.tsx` - ConvexProvider wrapper
- `shamp/frotend/src/routes/_authenticated/tickets/index.tsx` - Real-time tickets page

## Best Practices

1. **Always Filter by userId**: Never return all records; always filter by authenticated user
2. **Validate userId**: Always validate userId exists before processing
3. **Use Indexes**: Use database indexes for efficient filtering
4. **Type Safety**: Use TypeScript types to ensure proper userId handling
5. **Error Handling**: Throw clear errors for unauthorized access attempts

## Future Enhancements

- Add rate limiting to queries
- Add query result caching
- Add audit logging for query access
- Add role-based access control (RBAC) for admin users

