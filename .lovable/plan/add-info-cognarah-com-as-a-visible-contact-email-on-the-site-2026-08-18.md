# Add info@cognarah.com as a visible contact email on the site

## Goal
Make `info@cognarah.com` findable on the public site so visitors can reach out for collaborations, partnerships, or tips.

## Current state
- The footer (`src/components/site/footer.tsx`) has a "Contact" link pointing to `mailto:hello@cognarah.com`.
- The About page (`src/routes/about.tsx`) shows `hello@cognarah.com` under a "Contact" heading.
- There is no dedicated `/contact` route.

## Plan
1. **Footer** — Update the existing "Contact" mailto link to `info@cognarah.com`. Additionally, display the email address as readable text (e.g. `info@cognarah.com` under the social icons in the footer's brand column) so it is visible without clicking.
2. **About page** — Update the contact email from `hello@cognarah.com` to `info@cognarah.com`, and broaden the label from "Tips, pitches, partnerships" to also mention collaborations.

No new routes or tables. No em dashes. Purely presentational edits.

## Technical details
- `src/components/site/footer.tsx`: change line 67 mailto target; add a small `<a href="mailto:info@cognarah.com">info@cognarah.com</a>` line in the brand column near the social icons.
- `src/routes/about.tsx`: change line 52 href and text to `info@cognarah.com`; update the preceding sentence to mention collaborations.
