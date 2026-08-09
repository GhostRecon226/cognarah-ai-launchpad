import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Pagination } from "@/components/site/pagination";
import { getRange, totalPages as calcTotalPages } from "@/lib/pagination";
import { useRoles } from "@/lib/admin-roles";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Row { id: string; title: string; slug: string; status: string; updated_at: string; view_count: number; category?: { name: string } | null }

const PAGE_SIZE = 20;

const searchSchema = z.object({
  page: fallback(z.number().int(), 1).default(1),
  filter: fallback(z.string(), "all").default("all"),
});

export const Route = createFileRoute("/_authenticated/admin/articles/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Articles: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: ArticlesList,
});

function ArticlesList() {
  return (
    <AdminShell title="Articles">
      <ArticlesListInner />
    </AdminShell>
  );
}

function ArticlesListInner() {
  const { hasAny } = useRoles();
  const canDelete = hasAny(["admin", "editor"]);
  const { page: rawPage, filter: rawFilter } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/articles/" });
  const filter: "all" | "published" | "draft" =
    rawFilter === "published" || rawFilter === "draft" ? rawFilter : "all";
  const page = Math.max(1, rawPage);

  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalPages = calcTotalPages(count, PAGE_SIZE);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const { from, to } = getRange(page, PAGE_SIZE);
      let q = supabase
        .from("articles")
        .select("id,title,slug,status,updated_at,view_count,category:categories(name)", { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error, count: c } = await q;
      if (error) {
        const msg = `${error.message}${error.code ? ` (code ${error.code})` : ""}${error.details ? ` – ${error.details}` : ""}${error.hint ? ` – hint: ${error.hint}` : ""}`;
        setLoadError(msg);
        toast.error(`Failed to load articles: ${msg}`);
        setRows([]);
        setCount(0);
        return;
      }
      setRows((data ?? []) as unknown as Row[]);
      setCount(c ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      setLoadError(msg);
      toast.error(`Failed to load articles: ${msg}`);
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, page]);

  async function del(id: string) {
    if (!confirm("Delete this article?")) return;
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  }

  function setFilter(f: "all" | "published" | "draft") {
    navigate({ search: { filter: f, page: 1 } });
  }

  function buildHref(p: number) {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (p !== 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/articles?${qs}` : "/admin/articles";
  }

  const from = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(count, page * PAGE_SIZE);

  return (
    <>
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex gap-1 self-start rounded-md border border-border bg-background p-1">
          {(["all", "published", "draft"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded px-3 py-1.5 text-sm capitalize ${filter === f ? "bg-navy text-white" : "text-muted-foreground"}`}>{f}</button>
          ))}
        </div>
        <Link to="/admin/articles/new" className="inline-flex items-center justify-center gap-1.5 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy/90">
          <Plus className="h-4 w-4" /> New article
        </Link>
      </div>
      {loadError && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="font-semibold text-destructive">Failed to load articles</div>
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-destructive/90">{loadError}</pre>
          <button onClick={load} className="mt-3 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10">Retry</button>
        </div>
      )}
      {count > 0 && (
        <div className="mt-4 text-xs text-muted-foreground">
          Showing {from.toLocaleString()}–{to.toLocaleString()} of {count.toLocaleString()}
        </div>
      )}
      <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-background">
        {loading && <div className="p-4 text-xs text-muted-foreground">Loading…</div>}
        <table className="w-full min-w-[640px]">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Views</th><th className="px-4 py-3">Updated</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {rows.length === 0 && !loading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No articles yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3"><Link to="/admin/articles/$id" params={{ id: r.id }} className="font-medium hover:text-brand">{r.title}</Link></td>
                <td className="px-4 py-3 text-muted-foreground">{r.category?.name ?? "None"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "published" ? "bg-brand/15 text-brand" : "bg-secondary"}`}>{r.status}</span></td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{(r.view_count ?? 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{format(new Date(r.updated_at), "MMM d, yyyy")}</td>
                <td className="px-4 py-3 text-right">{canDelete && <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} buildHref={buildHref} />
    </>
  );
}
