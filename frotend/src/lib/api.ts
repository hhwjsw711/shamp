/**
 * API Client
 *
 * Best-practice auth:
 * - Use HttpOnly + Secure session cookies
 * - Always call the API as SAME-ORIGIN (relative /api/*)
 *
 * In production, TanStack Start (Cloudflare) proxies /api/* to Convex via a server route
 * at `src/routes/api/$.ts`, keeping cookies first-party.
 */

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
  providedToken?: string | null
): Promise<T> {
  // Token-based auth is intentionally not supported here.
  // Best practice is HttpOnly cookies to protect against XSS token theft.
  if (providedToken !== undefined && providedToken !== null) {
    throw new Error('Token-based auth is disabled. Use cookie-based sessions only.')
  }

  const { body, headers = {}, ...restOptions } = options

  const config: RequestInit = {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include', // Include cookies for session management
  }

  if (body) {
    config.body = JSON.stringify(body)
  }

  // Always use relative URL so cookies are first-party.
  const response = await fetch(endpoint, config)

  // Read response text once (can only be read once)
  const responseText = await response.text()

  if (!response.ok) {
    // Try to parse error response
    let errorData: { error?: string; message?: string } = { error: response.statusText }
    if (responseText) {
      try {
        errorData = JSON.parse(responseText)
      } catch {
        // If parsing fails, use status text
      }
    }
    // Backend returns { error: "message" } format
    const errorMessage = errorData.error || errorData.message || 'An error occurred'
    
    throw new Error(errorMessage)
  }

  // Parse successful JSON response
  if (!responseText) {
    throw new Error('Empty response body')
  }
  
  try {
    return JSON.parse(responseText) as T
  } catch (error) {
    throw new Error(`Failed to parse response: ${error instanceof Error ? error.message : 'Invalid JSON'}`)
  }
}

export const api = {
  // Auth endpoints
  auth: {
    register: (data: { email: string; password: string }) =>
      request<{
        success: boolean
        message: string
        user?: {
          id: string
          email: string
          emailVerified?: boolean
          onboardingCompleted?: boolean
        }
      }>('/api/auth/register', {
        method: 'POST',
        body: data,
      }),

    login: (data: { email: string; password: string }) =>
      request<{
        user: {
          id: string
          email: string
          name?: string
          orgName?: string
          location?: string
          emailVerified?: boolean
          onboardingCompleted?: boolean
        }
        message?: string
        token?: string // For localhost fallback
      }>('/api/auth/login', {
        method: 'POST',
        body: data,
      }),

    me: () =>
      request<{ user: unknown }>('/api/auth/me', {
        method: 'GET',
      }),

    logout: () =>
      request<{ message: string }>('/api/auth/logout', {
        method: 'POST',
      }),

    getGoogleAuthUrl: () =>
      request<{ url: string }>('/api/auth/google/url', {
        method: 'GET',
      }),
  },

  // Email verification endpoints
  emailVerification: {
    sendCode: (data: { email: string }) =>
      request<{ message: string }>(
        '/api/auth/email-verification/send-code',
        {
          method: 'POST',
          body: data,
        }
      ),

    verifyCode: (data: { code: string }) =>
      request<{ message: string }>(
        '/api/auth/email-verification/verify-code',
        {
          method: 'POST',
          body: { code: data.code },
        }
      ),
  },

  // Password reset endpoints
  passwordReset: {
    request: (data: { email: string }) =>
      request<{ success: boolean; message: string }>('/api/auth/password-reset/request', {
        method: 'POST',
        body: data,
      }),

    verify: (data: { code: string }) =>
      request<{ success: boolean; message: string; userId: string }>('/api/auth/password-reset/verify', {
        method: 'POST',
        body: data,
      }),

    complete: (data: {
      userId: string
      newPassword: string
    }) =>
      request<{ success: boolean; message: string }>('/api/auth/password-reset/complete', {
        method: 'POST',
        body: data,
      }),
  },

  // Onboarding endpoint
  onboarding: (data: {
    name: string
    orgName: string
    location: string
  }) =>
    request<{ message: string; pin?: string }>('/api/auth/onboarding', {
      method: 'POST',
      body: data,
    }),

  // Analytics endpoints
  analytics: {
    getDashboardStats: () =>
      request<{
        success: boolean
        data: {
          totalTickets: number
          ticketCountsByStatus: Record<string, number>
          averageResponseTimeMs: number | null
          averageResponseTimeHours: number | null
          averageFixTimeMs: number | null
          averageFixTimeHours: number | null
          mostUsedVendor: {
            _id: string
            businessName: string
            usageCount: number
          } | null
          newQuotesCount: number
          pendingQuotesCount: number
          selectedQuotesCount: number
          rejectedQuotesCount: number
          expiredQuotesCount: number
          totalQuotesReceived: number
          ticketsAwaitingSelection: number
          averageQuotePrice: number | null
          averageQuoteDeliveryTimeHours: number | null
        }
      }>('/api/analytics/dashboard', {
        method: 'GET',
      }),
  },

  // Ticket endpoints
  tickets: {
    create: async (data: {
      description: string
      photoIds: Array<string>
      location?: string
      name?: string
      urgency?: 'emergency' | 'urgent' | 'normal' | 'low'
    }) => {
      // Send as JSON with photoIds array (files are already uploaded)
      return request<{
        success: boolean
        ticket: {
          _id: string
          [key: string]: unknown
        }
      }>('/api/tickets', {
        method: 'POST',
        body: {
          description: data.description,
          photoIds: data.photoIds,
          location: data.location,
          name: data.name,
          urgency: data.urgency,
        },
      })
    },
    getById: async (ticketId: string) => {
      return request<{
        success: boolean
        ticket: {
          _id: string
          createdBy: string
          name?: string
          description: string
          location?: string
          status: string
          urgency?: 'emergency' | 'urgent' | 'normal' | 'low'
          issueType?: string
          predictedTags?: Array<string>
          problemDescription?: string
          photoIds: Array<string>
          photoUrls?: Array<string | null>
          createdAt: number
          [key: string]: unknown
        }
      }>(`/api/tickets/${ticketId}`, {
        method: 'GET',
      })
    },
    update: async (ticketId: string, data: {
      description?: string
      photoIds?: Array<string>
      location?: string
      name?: string
      urgency?: 'emergency' | 'urgent' | 'normal' | 'low'
    }) => {
      console.log('[api.tickets.update] Starting update request:', {
        ticketId,
        data: {
          description: data.description?.substring(0, 50),
          location: data.location,
          photoIdsCount: data.photoIds?.length,
          urgency: data.urgency,
          name: data.name,
        },
      });
      
      const CONVEX_URL =
        import.meta.env.VITE_CONVEX_SITE_URL || 
        import.meta.env.VITE_CONVEX_URL?.replace('.convex.cloud', '.convex.site') ||
        ''
      
      console.log('[api.tickets.update] CONVEX_URL:', CONVEX_URL);
      
      const endpoint = `/api/tickets/${ticketId}`;
      const fullUrl = `${CONVEX_URL}${endpoint}`;
      console.log('[api.tickets.update] Full URL:', fullUrl);
      
      try {
        const result = await request<{
          success: boolean
          ticket: {
            _id: string
            photoUrls?: Array<string | null>
            [key: string]: unknown
          }
        }>(endpoint, {
          method: 'PATCH',
          body: data,
        });
        
        console.log('[api.tickets.update] Success:', result);
        return result;
      } catch (error) {
        console.error('[api.tickets.update] Error:', error);
        throw error;
      }
    },
    deleteFile: async (fileId: string) => {
      return request<{
        success: boolean
        message: string
      }>(`/api/files/${fileId}`, {
        method: 'DELETE',
      })
    },
    list: async (params?: {
      status?: string
      vendorId?: string
      location?: string
      tag?: string
    }) => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.vendorId) queryParams.append('vendorId', params.vendorId)
      if (params?.location) queryParams.append('location', params.location)
      if (params?.tag) queryParams.append('tag', params.tag)

      const queryString = queryParams.toString()
      const endpoint = `/api/tickets${queryString ? `?${queryString}` : ''}`

      return request<{
        success: boolean
        tickets: Array<{
          _id: string
          createdBy: string
          name?: string
          description: string
          location?: string
          status: string
          urgency?: string
          issueType?: string
          predictedTags?: Array<string>
          problemDescription?: string
          photoIds: Array<string>
          createdAt: number
          [key: string]: unknown
        }>
      }>(endpoint, {
        method: 'GET',
      })
    },
  },
}


