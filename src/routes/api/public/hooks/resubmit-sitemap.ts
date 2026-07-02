import { createFileRoute } from "@tanstack/react-router";

const SITE_URL = "https://cognarah.com/";
const SITEMAP_URL = "https://cognarah.com/sitemap.xml";
const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

export const Route = createFileRoute("/api/public/hooks/resubmit-sitemap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const expected = process.env.AGENT_CRON_SECRET;
        if (!expected || auth !== `Bearer ${expected}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const lovableKey = process.env.LOVABLE_API_KEY;
        const gscKey = process.env.GOOGLE_SEARCH_CONSOLE_API_KEY;
        if (!lovableKey || !gscKey) {
          return new Response(
            JSON.stringify({ error: "Search Console connector not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const siteEnc = encodeURIComponent(SITE_URL);
        const sitemapEnc = encodeURIComponent(SITEMAP_URL);
        const url = `${GATEWAY}/webmasters/v3/sites/${siteEnc}/sitemaps/${sitemapEnc}`;

        const res = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": gscKey,
          },
        });

        if (!res.ok && res.status !== 204) {
          const body = await res.text();
          return new Response(
            JSON.stringify({ ok: false, status: res.status, body }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ ok: true, submitted: SITEMAP_URL, at: new Date().toISOString() }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
