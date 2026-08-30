import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

// Resend sends webhook events shaped like { type: "email.bounced", data: {...} },
// signed the Svix way (see src/lib/resend-webhook.server.ts) — replaces the
// { data: { email, reason, ... } } shape the Go API used to forward from Mailgun
// via Lovable's webhook signing.
function mapEventTypeToReason(type: string): 'bounce' | 'complaint' | null {
  if (type === 'email.bounced') return 'bounce'
  if (type === 'email.complained') return 'complaint'
  return null
}

function mapReasonToStatus(
  reason: string,
): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce':
      return 'bounced'
    case 'complaint':
      return 'complained'
    default:
      return 'suppressed'
  }
}

function mapReasonToMessage(reason: string): string {
  switch (reason) {
    case 'bounce':
      return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint':
      return 'Spam complaint — recipient marked email as spam'
    case 'unsubscribe':
      return 'Recipient unsubscribed'
    default:
      return 'Email suppressed'
  }
}

export const Route = createFileRoute("/lovable/email/suppression")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Dynamic import: route files ship to the client bundle, so server-only
        // modules must be loaded inside the handler, not imported at the top level.
        let event: { type: string; data: Record<string, any> }
        try {
          const { verifyResendWebhook } = await import('@/lib/resend-webhook.server')
          event = await verifyResendWebhook(request, webhookSecret)
        } catch (error) {
          console.error('Webhook verification failed', {
            error: error instanceof Error ? error.message : error,
          })
          return Response.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const reason = mapEventTypeToReason(event.type)
        if (!reason) {
          // Not a suppression-relevant event (delivered/opened/clicked/sent/etc) —
          // accept it so Resend doesn't retry, just don't act on it.
          return Response.json({ success: true, ignored: true, type: event.type })
        }

        const recipient: string | undefined = Array.isArray(event.data?.to)
          ? event.data.to[0]
          : event.data?.to
        if (!recipient) {
          console.error('Missing recipient in webhook payload', { type: event.type })
          return Response.json({ error: 'Missing recipient' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const normalizedEmail = recipient.toLowerCase()
        // No stored mapping from our message_id to Resend's email_id, so the
        // suppression log's message_id stays null — the email_id goes in metadata
        // instead. Suppression itself is keyed by email, not message_id, so this
        // doesn't affect whether the address actually gets suppressed.
        const metadata = {
          resend_email_id: event.data?.email_id ?? null,
          ...(event.data?.bounce ? { bounce: event.data.bounce } : {}),
          ...(event.data?.complaint ? { complaint: event.data.complaint } : {}),
        }

        // 1. Upsert to suppressed_emails (idempotent — safe for retries)
        const { error: suppressError } = await supabase
          .from('suppressed_emails')
          .upsert(
            {
              email: normalizedEmail,
              reason,
              metadata,
            },
            { onConflict: 'email' },
          )

        if (suppressError) {
          console.error('Failed to upsert suppressed email', {
            error: suppressError,
            email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
          })
          return Response.json({ error: 'Failed to write suppression' }, { status: 500 })
        }

        // 2. Append a new log entry for the suppression event (never update existing rows)
        const sendLogStatus = mapReasonToStatus(reason)
        const sendLogMessage = mapReasonToMessage(reason)

        const { error: insertError } = await supabase
          .from('email_send_log')
          .insert({
            message_id: null,
            template_name: 'system',
            recipient_email: normalizedEmail,
            status: sendLogStatus,
            error_message: sendLogMessage,
            metadata,
          })

        if (insertError) {
          // Non-fatal — log and continue. The suppression was already recorded.
          console.warn('Failed to insert email_send_log', {
            error: insertError,
          })
        }

        console.log('Suppression processed', {
          email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
          reason,
          type: event.type,
        })

        return Response.json({ success: true })
      },
    },
  },
})
