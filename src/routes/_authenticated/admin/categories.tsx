import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { toast } from "sonner";
import slugify from "slugify";
import type { Category } from "@/lib/types";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Categories: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: CategoriesAdmin,
});

function CategoriesAdmin() {
  const [cats, setCats] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");

  async function load() {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setCats((data ?? []) as unknown as Category[]);
  }
  useEffect(() => { load(); }, []);

  async function save(c: Category) {
    const { error } = await supabase.from("categories").update({
      name: c.name, description: c.description, long_intro: c.long_intro, color: c.color, sort_order: c.sort_order, slug: c.slug,
    }).eq("id", c.id);
    if (error) toast.error(error.message); else toast.success("Saved");
  }
  async function add() {
    if (!newName) return;
    const slug = slugify(newName, { lower: true, strict: true });
    const { error } = await supabase.from("categories").insert({ name: newName, slug, sort_order: cats.length + 1 });
    if (error) toast.error(error.message);
    else { setNewName(""); load(); }
  }
  async function del(id: string) {
    if (!confirm("Delete this category?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  return (
    <AdminShell title="Categories" requiredRoles={["admin", "editor"]}>
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex gap-2">
          <input placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={add} className="inline-flex items-center gap-1 rounded bg-navy px-4 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" /> Add</button>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {cats.map((c) => (
          <div key={c.id} className="space-y-3 rounded-lg border border-border bg-background p-4">
            <div className="grid min-w-0 gap-3 md:grid-cols-[1fr_2fr_120px_80px_auto]">
              <input value={c.name} onChange={(e) => setCats(cs => cs.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))} className="min-w-0 rounded border border-border bg-background px-2 py-1.5 text-sm font-semibold" />
              <input value={c.description ?? ""} placeholder="Short description (meta)" onChange={(e) => setCats(cs => cs.map(x => x.id === c.id ? { ...x, description: e.target.value } : x))} className="min-w-0 rounded border border-border bg-background px-2 py-1.5 text-sm" />
              <input value={c.color ?? ""} placeholder="#1D9E75" onChange={(e) => setCats(cs => cs.map(x => x.id === c.id ? { ...x, color: e.target.value } : x))} className="min-w-0 rounded border border-border bg-background px-2 py-1.5 text-sm" />
              <input type="number" value={c.sort_order} onChange={(e) => setCats(cs => cs.map(x => x.id === c.id ? { ...x, sort_order: Number(e.target.value) } : x))} className="min-w-0 rounded border border-border bg-background px-2 py-1.5 text-sm" />
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => save(c)} className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white">Save</button>
                <button onClick={() => del(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <label className="block text-xs font-semibold text-muted-foreground">
              Long intro (shown on category page, supports basic HTML) — great for SEO
              <textarea
                value={c.long_intro ?? ""}
                placeholder="1–3 paragraphs introducing the category. Use <p>, <strong>, <a href='...'> etc."
                rows={4}
                onChange={(e) => setCats(cs => cs.map(x => x.id === c.id ? { ...x, long_intro: e.target.value } : x))}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs"
              />
            </label>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
