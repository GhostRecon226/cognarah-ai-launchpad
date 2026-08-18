# Sponsored ad slots for Startups and Funding

## Scope note

There is no standalone `/startups` listing page. The Startups and Funding section is served by the category pages `/category/startups` and `/category/funding` (the "Submit Your Startup" page is a form, not a listing). The top banner will render on both of those category pages. Inline banners will render on articles whose category is Startups or Funding.

## What gets built

### 1. Database

New table `sponsored_ads`:

- advertiser_name, image_url, destination_url
- placement: enum with values `startups_listing_top` and `article_inline`
- start_date, end_date (dates)
- active (boolean, default true)
- standard id and timestamps, with an updated-at trigger

Access rules:
- Anyone visiting the site can read only ads that are active and whose date range includes today.
- Admins and editors can create, edit, and delete ads.

A private storage bucket `sponsored-ads` holds uploaded creative, served through the existing app-side media redirect pattern so the bucket stays private and URLs never expire. Upload is limited to admins and editors.

### 2. Public display

- A `SponsoredBanner` component: a small uppercase "Sponsored" label above the image, the image linked to the destination URL, opening in a new tab with `rel="sponsored noopener noreferrer"`. Responsive, no layout shift.
- Category pages for Startups and Funding: fetch the current active `startups_listing_top` ad and render the banner above the article grid. Nothing renders when no ad matches.
- Article pages: when the article's category is Startups or Funding, fetch the current active `article_inline` ad and insert the banner after the second paragraph of the body. The page already splits the body after the second paragraph for the existing in-article ad slot, so the sponsored banner is placed at that same break, above the AdSense unit.
- If multiple ads match, the most recently created one is used.

### 3. Admin page `/admin/ads`

Reachable by admin and editor roles, added to the admin sidebar.

- Table of all ads: advertiser, thumbnail, placement, date range, active toggle, edit and delete.
- Create and edit form: advertiser name, image upload (stored in the `sponsored-ads` bucket) with live preview, destination URL, placement select, start and end date, active switch.
- Basic validation: destination URL must be a valid http(s) URL, end date must not be before start date, image required.
- Status hint per row: Scheduled, Live, Expired, or Paused, based on dates and the active flag.

## Technical details

- Table creation, grants, RLS, and the enum go through one migration; the bucket is created with the storage tool and its policies added by migration.
- Public reads use the existing browser Supabase client from the category and article loaders, filtered by `active = true and start_date <= today and end_date >= today`.
- Image serving reuses the existing `/api/public/media/...` style signed redirect, extended for the `sponsored-ads` bucket.
- All copy avoids em dashes.
