import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { useRoles } from "@/lib/admin-roles";
import { TiptapEditor } from "@/components/admin/tiptap-editor";
import { toast } from "sonner";
import slugify from "slugify";
import type { Article, Category, Author } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/articles/$id")({
  head: () => ({ meta: [{ title: "Edit article — Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: EditArticle,
});

function EditArticle() {
  const { id } = useParams({ from: "/_authenticated/admin/articles/$id" });
  const isNew = id === "new";
  const navigate = useNavigate();
  const { userId, hasAny } = useRoles();
  const canPublish = hasAny(["admin", "editor"]);
  const [cats, setCats] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [a, setA] = useState<Partial<Article>>({
    title: "", slug: "", excerpt: "", body: "", hero_image: "",
    tags: [], status: "draft", read_time: 3, is_featured: false,
    seo_title: "", meta_description: "",
  });
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, au] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("authors").select("*").order("name"),
      ]);
      setCats((c.data ?? []) as unknown as Category[]);
      setAuthors((au.data ?? []) as unknown as Author[]);
      if (!isNew) {
        const { data } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
        if (data) {
          const ar = data as unknown as Article;
          setA(ar);
          setTagsInput((ar.tags ?? []).join(", "));
        }
      }
    })();
  }, [id, isNew]);

  async function uploadHero(file: File) {
    const path = `hero/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    setA((s) => ({ ...s, hero_image: data.publicUrl }));
  }

  async function save(publish?: boolean) {
    setLoading(true);
    const slug = (a.slug || slugify(a.title ?? "", { lower: true, strict: true })).slice(0, 120);
    const payload: any = {
      title: a.title, slug, excerpt: a.excerpt, body: a.body, hero_image: a.hero_image || null,
      author_id: a.author_id || null, category_id: a.category_id || null,
      tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      seo_title: a.seo_title || null, meta_description: a.meta_description || null,
      read_time: Number(a.read_time) || 3, is_featured: !!a.is_featured,
      status: publish && canPublish ? "published" : (publish ? a.status ?? "draft" : a.status ?? "draft"),
      published_at: publish && canPublish ? new Date().toISOString() : (a.published_at ?? null),
    };
    let res;
    if (isNew) {
      res = await supabase.from("articles").insert({ ...payload, author_user_id: userId }).select("id").maybeSingle();
    } else {
      res = await supabase.from("articles").update(payload).eq("id", id).select("id").maybeSingle();
    }
    setLoading(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(publish ? "Published" : "Saved");
    if (isNew && res.data) navigate({ to: "/admin/articles/$id", params: { id: (res.data as any).id } });
  }

  return (
    <AdminShell title={isNew ? "New article" : "Edit article"}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <input placeholder="Title" value={a.title ?? ""} onChange={(e) => setA({ ...a, title: e.target.value, slug: a.slug || slugify(e.target.value, { lower: true, strict: true }) })} className="w-full rounded-md border border-border bg-background px-4 py-3 text-2xl font-bold outline-none focus:ring-2 focus:ring-brand" />
          <input placeholder="article-slug" value={a.slug ?? ""} onChange={(e) => setA({ ...a, slug: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand" />
          <textarea placeholder="Excerpt (1–2 sentences shown on cards)" value={a.excerpt ?? ""} onChange={(e) => setA({ ...a, excerpt: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-brand" rows={2} />
          <TiptapEditor value={a.body ?? ""} onChange={(html) => setA((s) => ({ ...s, body: html }))} />
        </div>
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">Publish</h3>
            <div className="mt-3 space-y-2">
              <button disabled={loading} onClick={() => save(false)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary">Save draft</button>
              {canPublish && (
                <button disabled={loading} onClick={() => save(true)} className="w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand/90">Publish</button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Status: {a.status}{!canPublish && " · You can save drafts; an editor will publish."}</p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4 space-y-3">
            <h3 className="text-sm font-semibold">Hero image</h3>
            {a.hero_image && <img src={a.hero_image} alt="" className="aspect-video w-full rounded object-cover" />}
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadHero(e.target.files[0])} className="block w-full text-xs" />
            <input placeholder="…or paste image URL" value={a.hero_image ?? ""} onChange={(e) => setA({ ...a, hero_image: e.target.value })} className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
          </div>
          <div className="rounded-lg border border-border bg-background p-4 space-y-3">
            <label className="block text-sm font-semibold">Category
              <select value={a.category_id ?? ""} onChange={(e) => setA({ ...a, category_id: e.target.value || undefined })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
                <option value="">—</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">Author
              <select value={a.author_id ?? ""} onChange={(e) => setA({ ...a, author_id: e.target.value || undefined })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
                <option value="">—</option>
                {authors.map((au) => <option key={au.id} value={au.id}>{au.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">Tags
              <input placeholder="comma, separated, tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-sm font-semibold">Read time (min)
              <input type="number" min={1} value={a.read_time ?? 3} onChange={(e) => setA({ ...a, read_time: Number(e.target.value) })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!a.is_featured} onChange={(e) => setA({ ...a, is_featured: e.target.checked })} />
              Featured on homepage
            </label>
          </div>
          <div className="rounded-lg border border-border bg-background p-4 space-y-3">
            <h3 className="text-sm font-semibold">SEO</h3>
            <input placeholder="SEO title" value={a.seo_title ?? ""} onChange={(e) => setA({ ...a, seo_title: e.target.value })} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" />
            <textarea placeholder="Meta description" value={a.meta_description ?? ""} onChange={(e) => setA({ ...a, meta_description: e.target.value })} rows={3} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" />
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}
