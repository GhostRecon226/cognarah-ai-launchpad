## Plan: Update Favicon

Replace the current favicon with the uploaded `LOGO_ICON_TP.png` logo.

### Steps
1. Copy the uploaded logo from `user-uploads://LOGO_ICON_TP.png` to `public/favicon.png`.
2. Update `src/routes/__root.tsx` — change the favicon `<link>` `href` from the old CDN asset URL to `/favicon.png`.

No existing `public/favicon.ico` is present, so no deletion step is needed.