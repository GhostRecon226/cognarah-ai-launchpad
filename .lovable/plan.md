## Make "Cognarah at a Glance" data-driven

The section at `src/routes/index.tsx:162-192` currently renders a hardcoded array of 6 fake headlines. That's why it still shows content after the articles table was cleared.

### Fix
Replace the hardcoded list with real published articles from the database:

- Extend the homepage loader to fetch the 6 most recent published articles (title + slug), ordered by `published_at desc`.
- Render each row as a numbered link to `/article/$slug` using the article title (keep the numbered style, brand color, and the Africa-orange accent for any article in the Africa category instead of always item #4).
- If there are fewer than 6 published articles, only render the ones that exist.
- If there are zero published articles, hide the entire section (so a freshly launched blog doesn't show an empty "At a Glance" band).

No schema changes. Only `src/routes/index.tsx` (and its loader/query) is touched.