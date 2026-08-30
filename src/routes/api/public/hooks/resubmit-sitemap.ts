import { createFileRoute } from "@tanstack/react-router";

const SITE_URL = "https://cognarah.com/";
const SITEMAP_URL = "https://cognarah.com/sitemap.xml";
// Search Console's Sitemaps resource only exists on the legacy Webmasters API v3 host —
// it was never ported to the newer searchconsole.googleapis.com host.
const SEARCH_CONSOLE_API = "https://www.googleapis.com/webmasters/v3";
const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters";

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
        let accessToken: string;
        try {
          const { getGoogleAccessToken } = await import("@/lib/google-service-account.server");
          accessToken = await getGoogleAccessToken(SEARCH_CONSOLE_SCOPE);
        } catch (e: any) {
          return new Response(
            JSON.stringify({ error: `Search Console connector not configured: ${e?.message || e}` }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const siteEnc = encodeURIComponent(SITE_URL);
        const sitemapEnc = encodeURIComponent(SITEMAP_URL);
        const url = `${SEARCH_CONSOLE_API}/sites/${siteEnc}/sitemaps/${sitemapEnc}`;

        const res = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
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
