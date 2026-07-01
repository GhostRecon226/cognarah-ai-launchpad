import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { useRoles } from "@/lib/admin-roles";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Row { id: string; title: string; slug: string; status: string; updated_at: string; category?: { name: string } | null }

export const Route = createFileRoute("/_authenticated/admin/articles/")({
  head: () => ({ meta: [{ title: "Articles — Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: ArticlesList,
});

function ArticlesList() {
  const { hasAny } = useRoles();
  const canDelete = hasAny(["admin", "editor"]);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");

  async function load() {
    let q = supabase.from("articles").select("id,title,slug,status,updated_at,category:categories(name)").order("updated_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows((data ?? []) as unknown as Row[]);
  }
  useEffect(() => { load(); }, [filter]);

  async function del(id: string) {
    if (!confirm("Delete this article?")) return;
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  }

  return (
    <AdminShell title="Articles">
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
      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-background">
        <table className="w-full min-w-[640px]">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No articles yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3"><Link to="/admin/articles/$id" params={{ id: r.id }} className="font-medium hover:text-brand">{r.title}</Link></td>
                <td className="px-4 py-3 text-muted-foreground">{r.category?.name ?? "—"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "published" ? "bg-brand/15 text-brand" : "bg-secondary"}`}>{r.status}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{format(new Date(r.updated_at), "MMM d, yyyy")}</td>
                <td className="px-4 py-3 text-right">{canDelete && <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
