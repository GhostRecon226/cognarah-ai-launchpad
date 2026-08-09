import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/admin-shell";
import { getDashboardAnalytics } from "@/lib/analytics.functions";
import { Eye, Users, Mail, Rocket, FileText, TrendingUp, Globe, Megaphone } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct",
  search: "Search",
  social: "Social",
  email: "Email",
  referral: "Referral",
  internal: "Internal",
  paid: "Paid",
};

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Eye;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`rounded-md ${tone} p-2 text-white`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Sparkline({ series }: { series: Array<{ date: string; views: number; visitors: number }> }) {
  const max = Math.max(1, ...series.map((s) => s.views));
  return (
    <div className="flex h-32 items-end gap-[3px]">
      {series.map((s) => (
        <div key={s.date} className="group relative flex-1" title={`${s.date}: ${s.views} views, ${s.visitors} visitors`}>
          <div
            className="w-full rounded-t-sm bg-brand/70 transition-colors group-hover:bg-brand"
            style={{ height: `${Math.max(2, (s.views / max) * 128)}px` }}
          />
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const fetchAnalytics = useServerFn(getDashboardAnalytics);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "dashboard-analytics"],
    queryFn: () => fetchAnalytics(),
    refetchOnWindowFocus: false,
  });

  const k = data?.kpis;
  const noTracking = !!data && !data.tracking_start;

  return (
    <AdminShell title="Dashboard">
      {isLoading && <div className="rounded-lg border border-border bg-background p-6 text-sm text-muted-foreground">Loading analytics...</div>}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Could not load analytics: {(error as Error).message}
        </div>
      )}

      {k && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Total article views" value={k.total_views.toLocaleString()} sub="All time" icon={Eye} tone="bg-brand" />
            <Kpi
              label="Views this month"
              value={noTracking ? "No data" : k.views_this_month.toLocaleString()}
              sub={noTracking ? "Tracking just enabled" : "First party tracking"}
              icon={TrendingUp}
              tone="bg-navy"
            />
            <Kpi
              label="Unique visitors"
              value={noTracking ? "No data" : k.unique_visitors_month.toLocaleString()}
              sub="This month"
              icon={Users}
              tone="bg-africa"
            />
            <Kpi
              label="Subscribers"
              value={k.subscribers.toLocaleString()}
              sub={`+${k.subscribers_this_month} this month`}
              icon={Mail}
              tone="bg-navy"
            />
            <Kpi
              label="Startup submissions"
              value={k.submissions.toLocaleString()}
              sub={`${k.submissions_pending} pending review`}
              icon={Rocket}
              tone="bg-brand"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" /> Published</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{k.published}</div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" /> Drafts</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{k.drafts}</div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">Categories</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{k.categories}</div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">Authors</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{k.authors}</div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-background p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Views, last 30 days</h2>
                <Link to="/admin/articles/$id" params={{ id: "new" }} className="rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy/90">
                  New article
                </Link>
              </div>
              {noTracking ? (
                <p className="mt-6 text-sm text-muted-foreground">
                  No data available yet. Daily view tracking starts collecting from today, so this chart fills in as readers arrive.
                </p>
              ) : (
                <>
                  <div className="mt-4"><Sparkline series={data.series} /></div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{data.series[0]?.date}</span>
                    <span>{data.series[data.series.length - 1]?.date}</span>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border border-border bg-background p-5">
              <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-brand" /><h2 className="font-semibold">Traffic sources</h2></div>
              {data.sources.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No data available yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.sources.map((s) => {
                    const total = data.sources.reduce((sum, x) => sum + x.views, 0) || 1;
                    const pct = Math.round((s.views / total) * 100);
                    return (
                      <li key={s.source}>
                        <div className="flex justify-between text-sm">
                          <span>{SOURCE_LABELS[s.source] ?? s.source}</span>
                          <span className="tabular-nums text-muted-foreground">{s.views} ({pct}%)</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-secondary">
                          <div className="h-1.5 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-border bg-background">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <TrendingUp className="h-4 w-4 text-brand" />
              <h2 className="font-semibold">Top performing articles</h2>
              <span className="text-xs text-muted-foreground">lifetime views, tracked views last 30 days</span>
            </div>
            {data.topArticles.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No published articles yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 w-10">#</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Views</th>
                      <th className="px-4 py-3 text-right">Last 30d</th>
                      <th className="px-4 py-3">Published</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {data.topArticles.map((t, i) => (
                      <tr key={t.id} className="hover:bg-secondary/50">
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3">
                          <Link to="/admin/articles/$id" params={{ id: t.id }} className="font-medium hover:text-brand">{t.title}</Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{t.category ?? "None"}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{t.view_count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{t.tracked_views.toLocaleString()}</td>
                        <td className="px-4 py-3 text-muted-foreground">{t.published_at ? format(new Date(t.published_at), "MMM d, yyyy") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-background">
              <div className="border-b border-border p-4"><h2 className="font-semibold">Category performance</h2></div>
              {data.categoryPerformance.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No published articles yet.</div>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {data.categoryPerformance.map((c) => (
                    <li key={c.name} className="flex items-center justify-between p-4">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {c.views.toLocaleString()} views, {c.articles} articles, avg {c.avg.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-border bg-background">
              <div className="flex items-center gap-2 border-b border-border p-4">
                <Megaphone className="h-4 w-4 text-brand" />
                <h2 className="font-semibold">Referrers and campaigns</h2>
              </div>
              <div className="grid gap-6 p-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Top referrers</div>
                  {data.referrers.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No data available yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {data.referrers.map((r) => (
                        <li key={r.host} className="flex justify-between gap-3">
                          <span className="truncate">{r.host}</span>
                          <span className="tabular-nums text-muted-foreground">{r.views}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Top campaigns</div>
                  {data.campaigns.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No data available yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {data.campaigns.map((c) => (
                        <li key={c.campaign} className="flex justify-between gap-3">
                          <span className="truncate">{c.campaign}</span>
                          <span className="tabular-nums text-muted-foreground">{c.views}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
