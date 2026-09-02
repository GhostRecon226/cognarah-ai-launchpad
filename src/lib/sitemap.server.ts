// Shared Google Search Console sitemap-resubmission logic. Used by both the
// cron-secret-gated public hook (src/routes/api/public/hooks/resubmit-sitemap.ts)
// and the admin-triggered call fired from the article publish/update flow
// (src/lib/seo.functions.ts).
import { getGoogleAccessToken } from "./google-service-account.server";
import { SITE_URL } from "./types";

// Search Console properties are registered with a trailing slash for
// domain-prefixed http(s) properties — kept local to this file's API call,
// not part of the shared SITE_URL constant (which has no trailing slash).
const GSC_SITE_URL = `${SITE_URL}/`;
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
// Search Console's Sitemaps resource only exists on the legacy Webmasters API v3 host —
// it was never ported to the newer searchconsole.googleapis.com host.
const SEARCH_CONSOLE_API = "https://www.googleapis.com/webmasters/v3";
const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters";

export async function pingGoogleSitemap(): Promise<
  { ok: true; submitted: string; at: string } | { ok: false; status?: number; body?: string; error?: string }
> {
  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(SEARCH_CONSOLE_SCOPE);
  } catch (e: any) {
    return { ok: false, error: `Search Console connector not configured: ${e?.message || e}` };
  }

  const siteEnc = encodeURIComponent(GSC_SITE_URL);
  const sitemapEnc = encodeURIComponent(SITEMAP_URL);
  const url = `${SEARCH_CONSOLE_API}/sites/${siteEnc}/sitemaps/${sitemapEnc}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 204) {
    return { ok: false, status: res.status, body: await res.text() };
  }

  return { ok: true, submitted: SITEMAP_URL, at: new Date().toISOString() };
}
