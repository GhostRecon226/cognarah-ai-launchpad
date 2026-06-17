# Cognarah — Coming Soon Page

A single, premium, minimal landing page. The logo breathes; nothing competes with it.

## Visual direction

- **Background:** deep navy matching the logo (`#0A0F2C`), with a very subtle radial vignette of warm magenta/orange glow (echoing the logo's gradient swirl) to add depth without clutter.
- **Logo:** centered, large, generous whitespace. Caps at ~480px wide on desktop, scales down gracefully on mobile. Soft, slow ambient float/pulse animation (Motion for React) — restrained, not flashy.
- **Tagline:** `EVERYTHING AI. NOTHING ELSE.` — all caps, light weight (300), wide letter-spacing (~0.3em), light lavender (`#E5E7F5`) matching the logo wordmark color.
- **Sub-line:** `Launching soon. Stay tuned.` — smaller, muted (`#8B92B8`), normal case, lighter spacing.
- **Typography:** Space Grotesk (light/300) — modern, techy, clean. Loaded via `@fontsource/space-grotesk`.
- **No nav, no footer, no email field, no graphics.** Just the three elements above, perfectly centered, fully responsive.

## Assets

- Upload the user's logo to the Lovable CDN via `lovable-assets create` from `/mnt/user-uploads/LOGO_COGNARAH.png`. Store the pointer at `src/assets/cognarah-logo.png.asset.json`.
- Favicon: use the same logo image as `/favicon.ico` link in the root head (browser will scale; the C-swirl dominates the square so it reads well at small sizes). Wire it via a `<link rel="icon">` in `__root.tsx` head pointing at the CDN URL.

## Files to change

1. `src/styles.css` — set `--background` to `oklch` of `#0A0F2C`, `--foreground` to light lavender. Add Space Grotesk as `--font-display`.
2. `src/routes/__root.tsx` — update title to "Cognarah — Everything AI. Nothing Else.", meta description, og tags, and add favicon link to the CDN logo URL.
3. `src/routes/index.tsx` — replace placeholder with the coming-soon layout (flex centered, logo, tagline, sub-line). Add subtle Motion fade-in + ambient float on the logo.
4. `src/main`-equivalent entry — import `@fontsource/space-grotesk/300.css` and `/400.css`. (In TanStack Start, import at the top of `__root.tsx` or `src/start.ts`.)
5. Install `@fontsource/space-grotesk` and `motion`.

## Out of scope

- No email capture (per user choice).
- No Lovable Cloud / backend.
- No additional routes or pages.
