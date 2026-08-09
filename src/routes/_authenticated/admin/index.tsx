import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { FileText, Tags, Users, Pencil, TrendingUp } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [stats, setStats] = useState({ published: 0, drafts: 0, categories: 0, authors: 0 });
  const [recent, setRecent] = useState<Array<{ id: string; title: string; status: string; updated_at: string; slug: string }>>([]);
  const [top, setTop] = useState<Array<{ id: string; title: string; view_count: number; published_at: string | null; category: { name: string } | null }>>([]);

  useEffect(() => {
    (async () => {
      const [{ count: published }, { count: drafts }, { count: categories }, { count: authors }, { data: rec }, { data: topData }] = await Promise.all([
        supabase.from("articles").select("id", { head: true, count: "exact" }).eq("status", "published"),
        supabase.from("articles").select("id", { head: true, count: "exact" }).eq("status", "draft"),
        supabase.from("categories").select("id", { head: true, count: "exact" }),
        supabase.from("authors").select("id", { head: true, count: "exact" }),
        supabase.from("articles").select("id, title, status, updated_at, slug").order("updated_at", { ascending: false }).limit(8),
        supabase.from("articles").select("id, title, view_count, published_at, category:categories(name)").eq("status", "published").order("view_count", { ascending: false }).limit(10),
      ]);
      setStats({ published: published ?? 0, drafts: drafts ?? 0, categories: categories ?? 0, authors: authors ?? 0 });
      setRecent((rec ?? []) as typeof recent);
      setTop((topData ?? []) as unknown as typeof top);
    })();
  }, []);

  const cards = [
    { label: "Published", value: stats.published, icon: FileText, color: "bg-brand" },
    { label: "Drafts", value: stats.drafts, icon: Pencil, color: "bg-africa" },
    { label: "Categories", value: stats.categories, icon: Tags, color: "bg-navy" },
    { label: "Authors", value: stats.authors, icon: Users, color: "bg-navy" },
  ];

  return (
    <AdminShell title="Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-background p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <div className={`rounded-md ${c.color} p-2 text-white`}><c.icon className="h-4 w-4" /></div>
            </div>
            <div className="mt-2 text-3xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-lg border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-semibold">Recent activity</h2>
          <Link to="/admin/articles/$id" params={{ id: "new" }} className="rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy/90">New article</Link>
        </div>
        <ul className="divide-y divide-border">
          {recent.length === 0 && <li className="p-6 text-sm text-muted-foreground">No articles yet.</li>}
          {recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between p-4">
              <Link to="/admin/articles/$id" params={{ id: r.id }} className="font-medium hover:text-brand">{r.title}</Link>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className={`rounded-full px-2 py-0.5 ${r.status === "published" ? "bg-brand/15 text-brand" : "bg-secondary"}`}>{r.status}</span>
                <span>{formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-8 rounded-lg border border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <TrendingUp className="h-4 w-4 text-brand" />
          <h2 className="font-semibold">Top articles by views</h2>
          <span className="text-xs text-muted-foreground">all time</span>
        </div>
        {top.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No published articles yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 w-10">#</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Views</th>
                  <th className="px-4 py-3">Published</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {top.map((t, i) => (
                  <tr key={t.id} className="hover:bg-secondary/50">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3"><Link to="/admin/articles/$id" params={{ id: t.id }} className="font-medium hover:text-brand">{t.title}</Link></td>
                    <td className="px-4 py-3 text-muted-foreground">{t.category?.name ?? "None"}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{(t.view_count ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.published_at ? format(new Date(t.published_at), "MMM d, yyyy") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
