# End-to-end test: view tracking, scoring, promotion queue

Goal: verify the Phase 1 to 3 work actually functions against the live app and database, and report exactly what passes or fails.

## What gets tested

1. **View tracking**
   - Open a published article page in a real browser session, confirm the tracking request to `/api/public/track/view` returns success.
   - Query the `article_views` table to confirm a new row exists with the right slug, visitor hash, referrer group and UTM fields.
   - Reload the same article with UTM parameters in the URL and confirm the UTM values and source group are captured.
   - Confirm the article's lifetime `view_count` increments.

2. **Scoring**
   - Check a sample of recent articles for `newsworthiness_score`, `africa_relevance_score`, `promotion_score`, `promotion_reason` and `promotion_signals` values.
   - Recompute promotion scores from the promotion queue and confirm the numbers move in line with the fresh view data from step 1.
   - Flag any article where scores are null so we know whether the agent path is populating them.

3. **Promotion queue flow**
   - Load `/admin/promotion` as an authenticated admin, confirm the queue lists articles ranked by promotion score with signals and reasons visible.
   - Generate AI promotion copy for one article on at least one channel and confirm text comes back and contains no em dashes.
   - Build a UTM link and confirm the parameters match the selected channel.
   - Log a promotion for that article, then confirm a row lands in `article_promotions` and the item's distribution history and fatigue penalty update on rescore.

4. **Admin dashboard**
   - Load `/admin` and confirm KPI cards, the 30-day series, traffic sources and top articles reflect the data seen in the database, including the views generated in step 1.

## How it runs

- Drive the live preview with a headless browser using the injected admin session for the admin routes, and an unauthenticated context for the public article page so tracking behaves like a real reader.
- Read back results with direct database queries rather than trusting UI numbers alone.
- Capture screenshots of `/admin`, `/admin/promotion` and the article page as evidence.

## Notes

- This test writes real data: a handful of view rows and one promotion log entry on a real article. Test rows will be identified in the report so they can be removed if you prefer a clean table.
- No schema or application code changes are part of this test. If a failure turns up, I report it first and propose the fix separately.
