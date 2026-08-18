# Standard sponsored ad dimensions (per placement)

## Goal

Give advertisers a clear, fixed creative spec for each sponsored ad slot so you can tell interested clients exactly what to design. Both slots use a 7:1 leaderboard aspect ratio, with different recommended pixel sizes per placement.

## Recommended creative specs (what to tell clients)

| Placement | Where it appears | Aspect ratio | Recommended size |
|---|---|---|---|
| Startups listing top | Top of the Startups and Funding category listing pages | 7:1 | 1200 x 171 px |
| Article inline | After the second paragraph of articles in Startups and Funding | 7:1 | 700 x 100 px |

Clients should export at the recommended width (or wider) in JPG or PNG. The site crops to fill with `object-cover`, so keeping important content away from the top and bottom edges avoids clipping.

## What gets built

### 1. SponsoredBanner component (`src/components/site/sponsored-banner.tsx`)

- Accept the placement (already on the `SponsoredAd` type) and enforce a fixed aspect ratio of 7:1 on the image container using `aspect-[7/1]`, replacing the current free-height `object-cover`.
- The image keeps `w-full object-cover` so it fills the slot and crops cleanly to the 7:1 box.
- This makes both placements render at a consistent, predictable height regardless of the uploaded image's native dimensions.

### 2. Admin page (`src/routes/_authenticated/admin/ads.tsx`)

- Add a "Recommended size" hint next to the banner image field in the create/edit form, showing the spec for the currently selected placement (1200 x 171 for listing top, 700 x 100 for article inline). Updates live when the placement select changes.
- Add the same recommended-size column to the table thumbnail area as a small caption so you can see the spec at a glance per row.
- Add a short spec note at the top of the page summarizing both placements and their dimensions, so you can copy it straight to a client.

### 3. Specs constant (`src/lib/sponsored-ads.ts`)

- Add a `PLACEMENT_SPECS` map: for each placement, `{ aspect: "7/1", recommendedWidth, recommendedHeight, label }`.
- Used by both the banner component and the admin UI so the spec lives in one place.

## Technical details

- No database changes. Dimensions are a rendering convention, not stored data.
- No new dependencies.
- All copy avoids em dashes.

## Out of scope

- The AdSense hydration warning is caused by the AdSense script injecting its own `<ins>` element at runtime. Our AdUnit already gates rendering behind `mounted` and sets `suppressHydrationWarning`. That warning is external and left as-is.
