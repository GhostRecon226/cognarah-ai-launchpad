// Cloudflare's Cache API (`caches.default`) is a Worker's OWN edge cache.
// Unlike Cloudflare Pages/static hosting, a plain Worker (which is what this
// app runs as) doesn't get automatic edge caching for its responses — a
// route has to opt in explicitly by reading/writing this cache itself.
// Safe to no-op outside the Workers runtime (local `vite dev`, which has no
// global `caches`), and only caches GET responses that came back ok.
export async function withEdgeCache(request: Request, compute: () => Promise<Response>): Promise<Response> {
  // No @cloudflare/workers-types in this project, so `caches.default` (the
  // Workers-specific Cache API surface, distinct from the standard `caches`
  // global) has no local type — typed as any, matching this codebase's
  // existing convention for other environment-provided types (e.g. the
  // Supabase client in agent-core.server.ts).
  const cache: any = (globalThis as any).caches?.default;
  if (!cache || request.method !== "GET") return compute();

  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await compute();
  // response.ok only covers 2xx — the media route this also guards returns a
  // 302 redirect on success, which is just as cacheable. Only skip 4xx/5xx.
  if (response.status < 400) {
    await cache.put(request, response.clone());
  }
  return response;
}
