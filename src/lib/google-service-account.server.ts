// Minimal Google service-account OAuth2 (JWT Bearer) token exchange using Node's built-in
// crypto, instead of pulling in google-auth-library — matches this codebase's pattern of
// calling provider APIs directly (see src/lib/gemini.server.ts).
//
// REQUIRES: GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL, GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY
// (a Google Cloud service account, added as a verified user on the target Search Console
// property) — see LOVABLE-MIGRATION.md Phase 2b.
import { createSign } from "node:crypto";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function getGoogleAccessToken(scope: string): Promise<string> {
  const clientEmail = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL / GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY missing");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signInput = `${header}.${claim}`;
  const signature = base64url(createSign("RSA-SHA256").update(signInput).sign(privateKey));
  const jwt = `${signInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google OAuth token exchange ${res.status}: ${t.slice(0, 300)}`);
  }

  const json: any = await res.json();
  if (!json.access_token) throw new Error("Google OAuth token exchange returned no access_token");
  return json.access_token as string;
}
