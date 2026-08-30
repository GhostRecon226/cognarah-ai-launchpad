// Server-only: keep a promise alive past the HTTP response on Cloudflare Workers.
// server.ts stashes the current request's execution context on globalThis so
// server functions can reach ctx.waitUntil without threading it through their APIs.

type WaitUntilCtx = { waitUntil?: (p: Promise<unknown>) => void } | undefined;

declare global {
  // eslint-disable-next-line no-var
  var __cognarahRequestWaitUntil: WaitUntilCtx;
}

/**
 * Run work that must outlive the current HTTP response.
 * On Cloudflare Workers this uses ctx.waitUntil so the runtime keeps the
 * worker alive until the promise settles. On Node dev it falls back to a
 * plain fire-and-forget with error logging.
 */
export function runInBackground(work: Promise<unknown>): void {
  const wrapped = work.catch((err) => {
    console.error("[runInBackground] task failed:", err);
  });
  const ctx = globalThis.__cognarahRequestWaitUntil;
  const hasWaitUntil = !!(ctx && typeof ctx.waitUntil === "function");
  console.log(
    `[runInBackground] waitUntil ${hasWaitUntil ? "registered (worker will stay alive)" : "unavailable (fire-and-forget fallback)"}`,
  );
  if (hasWaitUntil) {
    try {
      ctx!.waitUntil!(wrapped);
      return;
    } catch (err) {
      console.error("[runInBackground] waitUntil rejected the promise:", err);
    }
  }
  // Fallback: just let the promise run. Fine in local dev on Node.
  void wrapped;
}
