## Goal
Make the "Website URL" field on `/startups/submit` accept any reasonable format (e.g. `example.com`, `www.example.com`, `https://example.com`). Auto-prepend `https://` before saving so stored URLs stay clickable.

## Changes

1. **`src/routes/startups.submit.tsx`**
   - Change the website input from `type="url"` to `type="text"` (the browser's `url` validator rejects bare domains).
   - Update placeholder to `example.com` and add a small hint: "We'll add https:// automatically."
   - Keep the field `required`.

2. **`src/lib/startup-submissions.functions.ts`**
   - In the handler, normalize `website_url` before insert:
     - Trim whitespace.
     - If it doesn't start with `http://` or `https://`, prepend `https://`.
     - Validate the normalized value with `new URL(...)` and reject with a clear error if it's still not a valid URL (e.g. contains spaces, no dot).
   - Store the normalized value.

## Out of scope
No DB schema changes. No changes to other URL fields (LinkedIn, demo, press links) unless requested later.
