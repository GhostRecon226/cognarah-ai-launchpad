## Summary
Extract the existing inline share buttons from the article page into a reusable `ArticleShare` component, then add a compact share bar to article cards so readers can share directly from listings.

## Steps

1. **Create `src/components/site/article-share.tsx`**
   - Props: `url: string`, `title: string`, `compact?: boolean`
   - Platforms: X (Twitter), LinkedIn, Facebook, WhatsApp
   - X link pre-fills `url` + `text` via `intent/tweet`
   - LinkedIn link opens `sharing/share-offsite/?url=` (title comes from OG tags)
   - Facebook link opens `sharer/sharer.php?u=` (title comes from OG tags)
   - WhatsApp link pre-fills `text` with title + URL
   - `compact` variant uses smaller icons and tighter spacing for cards

2. **Refactor `src/routes/article.$slug.tsx`**
   - Remove the inline share `<div>` (lines 134–141)
   - Import and render `<ArticleShare url={url} title={article.title} />` in the same spot

3. **Add compact share to `src/components/site/article-card.tsx`**
   - Import `<ArticleShare>`
   - Render `<ArticleShare compact url={...} title={article.title} />` below the meta row (after read time)
   - Use `SITE_URL` + article slug to build the full share URL

4. **Verify build passes**

## No backend changes required
All share links are client-side `window.open`/anchor `href` to native platform dialogs.