// Direct calls to Resend's API, replacing @lovable.dev/email-js / Lovable's email
// gateway (which proxied to Mailgun). Called directly via fetch, no Resend SDK
// dependency added — matches this codebase's pattern for provider APIs (see
// src/lib/gemini.server.ts, src/lib/google-service-account.server.ts).
//
// REQUIRES: RESEND_API_KEY — see LOVABLE-MIGRATION.md Phase 3.
//
// EmailAPIError carries `.status` and `.retryAfterSeconds`, the same shape
// src/routes/lovable/email/queue/process.ts's isRateLimited/isForbidden/
// getRetryAfterSeconds helpers already expect (they were written generically
// against "email-js >=0.x with structured errors", not tied to Lovable specifically)
// — so that queue-processing/retry/DLQ logic didn't need to change at all.
export class EmailAPIError extends Error {
  status: number;
  retryAfterSeconds: number | null;
  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "EmailAPIError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface SendEmailArgs {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  /** Used as Resend's Idempotency-Key so a queue retry can't double-send. */
  message_id?: string;
  /** Passed straight through as custom email headers (e.g. List-Unsubscribe). */
  headers?: Record<string, string>;
}

export async function sendResendEmail(args: SendEmailArgs): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(args.message_id ? { "Idempotency-Key": args.message_id } : {}),
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(args.headers ? { headers: args.headers } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : null;
    throw new EmailAPIError(`Resend API ${res.status}: ${body.slice(0, 300)}`, res.status, retryAfterSeconds);
  }

  const json: any = await res.json();
  return { id: json.id };
}
