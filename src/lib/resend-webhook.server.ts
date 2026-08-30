// Verifies Resend webhook signatures, replacing @lovable.dev/webhooks-js.
// Resend signs webhooks the same way Svix does: HMAC-SHA256 over
// "<svix-id>.<svix-timestamp>.<raw body>", base64-encoded, compared against
// the "v1,<sig>" entries in the svix-signature header. Implemented directly
// with Node's crypto rather than adding the svix package, matching this
// codebase's pattern of calling providers directly (see gemini.server.ts).
//
// REQUIRES: RESEND_WEBHOOK_SECRET (format "whsec_...") — from the Resend
// dashboard once a webhook endpoint is created. See LOVABLE-MIGRATION.md Phase 3.
import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export async function verifyResendWebhook(request: Request, secret: string): Promise<any> {
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new WebhookVerificationError("Missing svix-id/svix-timestamp/svix-signature header");
  }

  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) {
    throw new WebhookVerificationError("Stale webhook timestamp");
  }

  const rawBody = await request.text();
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBytes = Buffer.from(expected, "base64");

  // svix-signature can carry multiple space-separated "v1,<sig>" entries
  // (e.g. during secret rotation) — valid if any one matches.
  const valid = svixSignature
    .split(" ")
    .map((entry) => entry.split(",")[1])
    .filter(Boolean)
    .some((candidate) => {
      const candidateBytes = Buffer.from(candidate, "base64");
      return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
    });
  if (!valid) throw new WebhookVerificationError("Invalid webhook signature");

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new WebhookVerificationError("Invalid JSON payload");
  }
}
