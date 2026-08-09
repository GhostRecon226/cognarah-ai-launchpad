import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireStaff(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_any_role", {
    _user_id: context.userId,
    _roles: ["admin", "editor"],
  });
  if (error || !data) throw new Error("Forbidden");
}

interface ViewRow {
  article_id: string | null;
  occurred_at: string;
  visitor_hash: string | null;
  source_group: string;
  referrer_host: string | null;
  utm_campaign: string | null;
}

function startOfMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

/** Dashboard KPIs, traffic mix and top performers, all from first-party data. */
export const getDashboardAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context);
    const sb = context.supabase;
    const monthStart = startOfMonth();
    const windowStart = daysAgo(30);

    const [
      { count: published },
      { count: drafts },
      { count: categories },
      { count: authors },
      { count: subscribers },
      { count: subscribersThisMonth },
      { count: submissions },
      { count: submissionsPending },
      lifetime,
      viewsRes,
      trackingStartRes,
    ] = await Promise.all([
      sb.from("articles").select("id", { head: true, count: "exact" }).eq("status", "published"),
      sb.from("articles").select("id", { head: true, count: "exact" }).eq("status", "draft"),
      sb.from("categories").select("id", { head: true, count: "exact" }),
      sb.from("authors").select("id", { head: true, count: "exact" }),
      sb.from("newsletter_subscribers").select("id", { head: true, count: "exact" }),
      sb.from("newsletter_subscribers").select("id", { head: true, count: "exact" }).gte("created_at", monthStart),
      sb.from("startup_submissions").select("id", { head: true, count: "exact" }),
      sb.from("startup_submissions").select("id", { head: true, count: "exact" }).eq("status", "pending"),
      sb.from("articles").select("view_count").eq("status", "published"),
      sb
        .from("article_views")
        .select("article_id, occurred_at, visitor_hash, source_group, referrer_host, utm_campaign")
        .gte("occurred_at", windowStart)
        .order("occurred_at", { ascending: false })
        .limit(20000),
      sb.from("article_views").select("occurred_at").order("occurred_at", { ascending: true }).limit(1),
    ]);

    const totalLifetimeViews = (lifetime.data ?? []).reduce(
      (sum: number, r: any) => sum + (r.view_count ?? 0),
      0,
    );

    const rows: ViewRow[] = (viewsRes.data ?? []) as ViewRow[];
    const trackingStart: string | null = trackingStartRes.data?.[0]?.occurred_at ?? null;

    const monthRows = rows.filter((r) => r.occurred_at >= monthStart);
    const uniqueMonth = new Set(monthRows.map((r) => r.visitor_hash).filter(Boolean)).size;

    // Daily series for the last 30 days.
    const byDay = new Map<string, { views: number; visitors: Set<string> }>();
    for (let i = 29; i >= 0; i--) {
      byDay.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), {
        views: 0,
        visitors: new Set(),
      });
    }
    for (const r of rows) {
      const key = r.occurred_at.slice(0, 10);
      const bucket = byDay.get(key);
      if (!bucket) continue;
      bucket.views += 1;
      if (r.visitor_hash) bucket.visitors.add(r.visitor_hash);
    }
    const series = Array.from(byDay.entries()).map(([date, v]) => ({
      date,
      views: v.views,
      visitors: v.visitors.size,
    }));

    // Traffic sources over the window.
    const sourceCounts = new Map<string, number>();
    for (const r of rows) sourceCounts.set(r.source_group, (sourceCounts.get(r.source_group) ?? 0) + 1);
    const sources = Array.from(sourceCounts.entries())
      .map(([source, views]) => ({ source, views }))
      .sort((a, b) => b.views - a.views);

    // Top referrers.
    const refCounts = new Map<string, number>();
    for (const r of rows) if (r.referrer_host) refCounts.set(r.referrer_host, (refCounts.get(r.referrer_host) ?? 0) + 1);
    const referrers = Array.from(refCounts.entries())
      .map(([host, views]) => ({ host, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    // Top campaigns.
    const campCounts = new Map<string, number>();
    for (const r of rows) if (r.utm_campaign) campCounts.set(r.utm_campaign, (campCounts.get(r.utm_campaign) ?? 0) + 1);
    const campaigns = Array.from(campCounts.entries())
      .map(([campaign, views]) => ({ campaign, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    // Tracked views per article in the window.
    const perArticle = new Map<string, number>();
    for (const r of rows) if (r.article_id) perArticle.set(r.article_id, (perArticle.get(r.article_id) ?? 0) + 1);

    const { data: topArticlesRaw } = await sb
      .from("articles")
      .select("id, title, slug, view_count, published_at, promotion_score, category:categories(name)")
      .eq("status", "published")
      .order("view_count", { ascending: false })
      .limit(10);

    const topArticles = (topArticlesRaw ?? []).map((a: any) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      view_count: a.view_count ?? 0,
      tracked_views: perArticle.get(a.id) ?? 0,
      published_at: a.published_at,
      promotion_score: a.promotion_score ?? null,
      category: a.category?.name ?? null,
    }));

    // Category performance (lifetime views by category).
    const { data: catRows } = await sb
      .from("articles")
      .select("view_count, category:categories(name)")
      .eq("status", "published");
    const catMap = new Map<string, { views: number; articles: number }>();
    for (const r of (catRows ?? []) as any[]) {
      const name = r.category?.name ?? "Uncategorised";
      const cur = catMap.get(name) ?? { views: 0, articles: 0 };
      cur.views += r.view_count ?? 0;
      cur.articles += 1;
      catMap.set(name, cur);
    }
    const categoryPerformance = Array.from(catMap.entries())
      .map(([name, v]) => ({ name, views: v.views, articles: v.articles, avg: Math.round(v.views / v.articles) }))
      .sort((a, b) => b.views - a.views);

    return {
      tracking_start: trackingStart,
      kpis: {
        total_views: totalLifetimeViews,
        views_this_month: monthRows.length,
        unique_visitors_month: uniqueMonth,
        subscribers: subscribers ?? 0,
        subscribers_this_month: subscribersThisMonth ?? 0,
        submissions: submissions ?? 0,
        submissions_pending: submissionsPending ?? 0,
        published: published ?? 0,
        drafts: drafts ?? 0,
        categories: categories ?? 0,
        authors: authors ?? 0,
      },
      series,
      sources,
      referrers,
      campaigns,
      topArticles,
      categoryPerformance,
    };
  });
