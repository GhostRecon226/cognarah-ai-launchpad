## Problem

SSR crashes on `/article/$slug` (and any path that touches `src/lib/sanitize.ts`) with `TypeError: Cannot read properties of undefined (reading 'bind')`. The fallback "This page didn't load" page is shown.

Root cause: `isomorphic-dompurify` lazy-loads `jsdom` on the server. `jsdom` depends on Node APIs (notably `EventTarget` / Web stream internals) that aren't available in the Cloudflare Workers runtime where the app runs, so a `.bind` call on `undefined` throws during HTML sanitization.

## Fix

Swap the sanitizer for a Worker-compatible, pure-JS one. `sanitize-html` is the standard choice — no DOM/jsdom, works identically in Node, Workers, and the browser.

### Steps

1. `bun add sanitize-html` and `bun add -d @types/sanitize-html`. Remove `isomorphic-dompurify` from `package.json`.
2. Rewrite `src/lib/sanitize.ts` to use `sanitize-html` with the same allow-list currently in place (tags: `p, br, strong, em, u, s, a, ul, ol, li, h1–h4, blockquote, code, pre, img, figure, figcaption, hr, span, div`; attrs: `href, src, alt, title, target, rel, class`). Preserve the `sanitizeHtml(html: string): string` signature so callers don't change.
3. Verify by reloading `/article/<slug>` in preview — page should render the article body instead of the error fallback. Re-check server logs to confirm the `bind` TypeError stops appearing.

### Out of scope

No UI, route, RLS, or schema changes. The admin "New article" link already works (`/admin/articles/new` is handled by `articles.$id.tsx` via `id === "new"`); it only appeared broken because the same SSR error page rendered when the server entry blew up.