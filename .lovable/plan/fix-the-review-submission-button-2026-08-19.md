# Fix the "Review submission" button

## What it is meant to do

It is the call to action inside the notification email sent to info@cognarah.com when a founder submits a startup. Clicking it should take you straight to that submission in the CMS so you can read it and approve or reject.

## Why it does nothing right now

Two separate problems, both confirmed in the code:

1. In the admin email preview page, the email is rendered inside a fully locked-down iframe (`sandbox=""`). That setting blocks all links and navigation, so in the preview the button is intentionally dead. Nothing happens on click.
2. Even in a real delivered email, the button links to the generic list page `https://cognarah.com/admin/startups`. It never points at the specific submission, so it is not really a "review this submission" link.

## The fix

- Make the review link deep-link to the exact submission: `https://cognarah.com/admin/startups?submission=<id>`.
- Make the submissions page read that value on load: filter is set to show the row, the matching row auto-expands, and the page scrolls to it. If the id no longer exists, show the normal list with a short note that the submission was not found.
- Make the preview iframe behave sensibly: allow links to open in a new tab instead of being silently swallowed, and show the destination URL as plain text under the preview so you can always see and copy where the button goes.

## Technical notes

- `src/lib/startup-submissions.functions.ts` (line ~300) and `src/lib/email-preview.functions.ts` (line ~44): build `reviewUrl` from the submission id rather than the hardcoded list URL.
- `src/lib/email-templates/startup-submission-notification.tsx`: keep the fallback list URL when no id is supplied.
- `src/routes/_authenticated/admin/startups.tsx`: add a validated `submission` search param, and use it to seed `expanded` plus a scroll-into-view on first load.
- `src/routes/_authenticated/admin/email-preview.startup-submission.$id.tsx`: change the iframe sandbox to `allow-popups allow-popups-to-escape-sandbox` and render the review URL beneath the preview.
- No database changes. No em dashes in any new copy.
