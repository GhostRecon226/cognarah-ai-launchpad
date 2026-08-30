import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// A client that navigates away or reloads mid-render aborts the socket
// (ECONNRESET / "aborted"). That is not an application error, so it must not be
// logged or turned into an error page.
function isClientAbort(request: Request, error?: unknown): boolean {
  if (request.signal?.aborted) return true;
  const seen = new Set<unknown>();
  let current: any = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current.code === "ECONNRESET" || current.name === "AbortError") return true;
    if (typeof current.message === "string" && current.message === "aborted") return true;
    current = current.cause;
  }
  return false;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"}, try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  request: Request,
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const captured = consumeLastCapturedError();
  if (isClientAbort(request, captured)) {
    // Nothing to render for a disconnected client.
    return new Response(null, { status: 499 });
  }

  console.error(captured ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}


type ExecutionCtx = { waitUntil?: (p: Promise<unknown>) => void } | undefined;

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Expose Cloudflare's ctx.waitUntil to server-only code (see src/lib/background.server.ts)
    // so agent runs and other background work can outlive the HTTP response.
    const prev = (globalThis as any).__cognarahRequestWaitUntil as ExecutionCtx;
    (globalThis as any).__cognarahRequestWaitUntil = ctx as ExecutionCtx;
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(request, response);
    } catch (error) {
      if (isClientAbort(request, error)) return new Response(null, { status: 499 });
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } finally {
      (globalThis as any).__cognarahRequestWaitUntil = prev;
    }
  },
};
