// Server-only helper to enqueue a transactional email from trusted server code
// (e.g. from an unauthenticated public form handler). Bypasses the JWT-gated
// /lovable/email/transactional/send route by writing directly to the queue
// with the service role, mirroring the send route's render + enqueue logic.

import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "cognarah-ai-launchpad";
// Must exactly match a domain verified in Resend — see the comment on this same
// constant in ../../routes/lovable/email/transactional/send.ts.
const SENDER_DOMAIN = "notify.cognarah.com";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface EnqueueEmailArgs {
  templateName: string;
  recipientEmail?: string;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
}

export async function enqueueTransactionalEmail(args: EnqueueEmailArgs): Promise<
  { ok: true; queued: true } | { ok: false; reason: string }
> {
  const { supabaseAdmin: sa } = await import("@/integrations/supabase/client.server");
  // Types file has not been regenerated with the email tables/rpc yet.
  const supabaseAdmin = sa as any;

  const template = TEMPLATES[args.templateName];
  if (!template) return { ok: false, reason: `template_not_found:${args.templateName}` };

  const effectiveRecipient = template.to || args.recipientEmail;
  if (!effectiveRecipient) return { ok: false, reason: "missing_recipient" };

  const normalizedEmail = effectiveRecipient.toLowerCase();
  const messageId = crypto.randomUUID();
  const idempotencyKey = args.idempotencyKey || messageId;
  const templateData = (args.templateData ?? {}) as Record<string, any>;

  // Suppression check
  const { data: suppressed } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (suppressed) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: args.templateName,
      recipient_email: effectiveRecipient,
      status: "suppressed",
    });
    return { ok: false, reason: "email_suppressed" };
  }

  // Unsubscribe token (reuse or create)
  let unsubscribeToken: string;
  const { data: existingToken } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token;
  } else {
    const newToken = generateToken();
    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .upsert({ token: newToken, email: normalizedEmail }, { onConflict: "email", ignoreDuplicates: true });
    const { data: stored } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (!stored) return { ok: false, reason: "unsubscribe_token_error" };
    unsubscribeToken = stored.token;
  }

  // Render
  const element = React.createElement(template.component as React.ComponentType<any>, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: args.templateName,
    recipient_email: effectiveRecipient,
    status: "pending",
  });

  const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${SENDER_DOMAIN}>`,
      subject,
      html,
      text,
      purpose: "transactional",
      label: args.templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqueueError) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: args.templateName,
      recipient_email: effectiveRecipient,
      status: "failed",
      error_message: enqueueError.message,
    });
    return { ok: false, reason: enqueueError.message };
  }

  return { ok: true, queued: true };
}
