## Plan: Notify admins on new startup submissions (Lovable Emails)

Use Lovable's built-in email system to send an internal notification to `cognarah.ai@gmail.com` whenever a new row is inserted into `startup_submissions`.

### 1. Prerequisites (Lovable Emails)
- Prompt setup of an email sender domain (required — the project has none yet).
- Run email infrastructure setup (queues, send log, cron, suppression, unsubscribe tables).
- Scaffold app (transactional) email routes and template registry.

### 2. Template
- New template `src/lib/email-templates/startup-submission-notification.tsx`
- Registered in `src/lib/email-templates/registry.ts` as `startup-submission-notification`
- Subject: `New Startup Submission: {companyName}`
- Body (React Email, brand-styled, no em/en dashes) includes:
  - Company name, founder name, country + city, company stage
  - Product description, problem solved
  - Founder email, preferred contact method (+ WhatsApp if provided)
  - Submitted-at timestamp
  - CTA button linking to `https://cognarah.com/admin/startups`
- All string props run through `stripEmDashes` before rendering.

### 3. Trigger
- In the existing public submission server function (`src/lib/startup-submissions.functions.ts`), after the successful insert:
  - Enqueue the email internally via the scaffolded send route, using the service role (public submitters have no JWT), with:
    - `templateName: "startup-submission-notification"`
    - `recipientEmail: "cognarah.ai@gmail.com"`
    - `idempotencyKey: submission-notify-{submission.id}`
    - `templateData`: the fields listed above
  - Wrapped in try/catch so email failures never block submission success.

### 4. Content sanitation
- Every text field passed to the template is run through the existing `stripEmDashes` helper.

### Notes
- No Resend, no external API keys, no DB triggers.
- Uses the built-in queue: retries, DLQ, and delivery visibility come for free (`email_send_log`).
- The unsubscribe footer Lovable appends is fine for an internal admin recipient.

### What you'll need to do
Complete the email domain setup dialog when it appears; everything else is automated.
