import { createFileRoute } from '@tanstack/react-router'

function getConvexSiteUrl(): string | null {
  // Vite inlines import.meta.env at build-time for both client & server bundles.
  // This value is not sensitive (it's a public URL), but it must be present for the proxy to work.
  const url =
    (import.meta as any).env?.VITE_CONVEX_SITE_URL ||
    (import.meta as any).env?.VITE_CONVEX_URL?.replace?.('.convex.cloud', '.convex.site') ||
    (process.env as any)?.VITE_CONVEX_SITE_URL ||
    (process.env as any)?.VITE_CONVEX_URL?.replace?.('.convex.cloud', '.convex.site')

  if (!url || typeof url !== 'string') return null
  return url
}

async function proxyToConvex({
  request,
  params,
}: {
  request: Request
  params: { _splat?: string }
}): Promise<Response> {
  const convexSiteUrl = getConvexSiteUrl()
  if (!convexSiteUrl) {
    return new Response(
      'Convex site URL is not configured. Set VITE_CONVEX_SITE_URL (preferred) or VITE_CONVEX_URL.',
      { status: 500 }
    )
  }

  const incomingUrl = new URL(request.url)
  const splat = params._splat ?? ''
  const targetPath = splat ? `/api/${splat}` : '/api'
  const targetUrl = new URL(targetPath, convexSiteUrl)
  targetUrl.search = incomingUrl.search

  const headers = new Headers(request.headers)
  // Preserve the original app origin for upstream handlers (eg Google OAuth redirect_uri)
  headers.set('x-forwarded-origin', incomingUrl.origin)
  // This is a server-side proxy; CORS is irrelevant. Forwarding Origin can cause confusing
  // reflected CORS headers from upstream, so we drop it.
  headers.delete('origin')

  // If we forward a Host header, some runtimes will reject it. Let fetch set it.
  headers.delete('host')

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  // Only forward a body for methods that can have one.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
  }

  const upstreamResponse = await fetch(targetUrl.toString(), init)

  // Clone headers so we can adjust Set-Cookie if needed.
  const responseHeaders = new Headers(upstreamResponse.headers)

  // Best-practice cookie setup is HttpOnly+Secure and first-party.
  // If upstream accidentally sets a Domain that doesn't match this app host,
  // browsers will reject it. Strip Domain defensively.
  const setCookie = upstreamResponse.headers.get('set-cookie')
  if (setCookie) {
    responseHeaders.set('set-cookie', setCookie.replace(/;\s*Domain=[^;]+/gi, ''))
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  })
}

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: proxyToConvex,
      POST: proxyToConvex,
      PUT: proxyToConvex,
      PATCH: proxyToConvex,
      DELETE: proxyToConvex,
      OPTIONS: proxyToConvex,
    },
  },
})

