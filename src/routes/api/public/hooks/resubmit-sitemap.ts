import { createFileRoute } from "@tanstack/react-router";

// Kept as a standalone, cron-secret-gated hook for any external/scheduled
// trigger (e.g. a future pg_cron job), in addition to the admin-triggered
// call fired directly from the publish/update flow (src/lib/seo.functions.ts).
// Both share the same underlying logic in src/lib/sitemap.server.ts.
export const Route = createFileRoute("/api/public/hooks/resubmit-sitemap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const expected = process.env.AGENT_CRON_SECRET;
        if (!expected || auth !== `Bearer ${expected}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        // Dynamic import: route files ship to the client bundle, so server-only modules
        // must be loaded inside the handler, not imported at the top level.
        const { pingGoogleSitemap } = await import("@/lib/sitemap.server");
        const result = await pingGoogleSitemap();

        if (!result.ok) {
          return new Response(JSON.stringify(result), {
            status: result.error ? 500 : 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
