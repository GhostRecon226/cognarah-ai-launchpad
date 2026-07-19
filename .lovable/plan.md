## Google AdSense Integration

### 1. Central config (`src/lib/adsense.ts`)
Single source of truth so publisher/slot IDs are updated in one place:
- `ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX"` (placeholder)
- `AD_SLOTS = { inArticleTop, inArticleBottom, homepageBanner, sidebar }` — all placeholder strings you swap later.

### 2. Global loader script (`src/routes/__root.tsx`)
Add the AdSense `<script>` to the root `head()` `scripts` array so it loads on every page:
```
{ src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX",
  async: true, crossOrigin: "anonymous" }
```

### 3. Reusable component (`src/components/site/ad-unit.tsx`)
Props: `slot: string`, `position: "in-article" | "homepage-banner" | "sidebar"`, optional `className`.
- Renders the standard `<ins class="adsbygoogle">` with `data-ad-client={ADSENSE_CLIENT}` and `data-ad-slot={slot}`.
- Calls `(window.adsbygoogle = window.adsbygoogle || []).push({})` inside a `useEffect` (client-only, wrapped in try/catch so SSR and blockers don't crash).
- Position → responsive layout:
  - `in-article`: `data-ad-format="fluid"` `data-ad-layout="in-article"`, full-width block with vertical spacing.
  - `homepage-banner`: `data-ad-format="auto"` `data-full-width-responsive="true"`, full-width mobile, capped max-width on desktop.
  - `sidebar`: fixed 300×600 desktop; uses `useIsMobile()` to return `null` on mobile (does not render at all).
- Wrapper carries an "Advertisement" label (small, muted) so we stay compliant with AdSense placement rules.

### 4. Placements
- **Article page** (`src/routes/article.$slug.tsx`): the body is rendered from a single `dangerouslySetInnerHTML`. To insert one ad after the second paragraph, split the sanitized HTML on `</p>` (first two occurrences), then render `[first 2 paragraphs] + <AdUnit position="in-article" slot={inArticleTop}/> + [rest]`. Add a second `<AdUnit position="in-article" slot={inArticleBottom}/>` right after the article body `<div>` and before the author card / related-articles section.
- **Homepage** (`src/routes/index.tsx`): insert `<AdUnit position="homepage-banner" slot={homepageBanner}/>` between the "Cognarah at a Glance" section and the "Africa AI Spotlight" band. Lead / secondary stack are untouched so nothing lands above the fold.
- **Sidebar on article pages**: the article layout is a single centered `max-w-3xl` column with no sidebar. I'll flag this and *not* introduce a new layout — sticky sidebar ad is skipped until a sidebar layout exists. (Confirm if you'd like me to add a desktop sidebar column instead.)

### 5. Privacy policy
There is no existing privacy policy route in the project (`/privacy`, `/privacy-policy`, etc. don't exist). The instruction says "do not create a new page," so I'll pause on this step and wait for you to point me at the page (or approve creating `/privacy`) along with the disclosure text.

### 6. Mobile responsiveness
- `in-article` and `homepage-banner` are fluid/responsive by design and inherit the site's existing container padding (`px-4 sm:px-6`).
- `sidebar` uses the site's existing `useIsMobile()` (`< 768px`) breakpoint and returns `null` on mobile.

### Files touched
- New: `src/lib/adsense.ts`, `src/components/site/ad-unit.tsx`
- Edited: `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/article.$slug.tsx`

### Open questions
1. Privacy policy page doesn't exist — should I create `/privacy` when you send the text, or is it hosted elsewhere?
2. Article pages have no sidebar today — skip the sticky sidebar ad, or add a desktop-only sidebar column to the article layout?
