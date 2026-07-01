import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { toast } from "sonner";
import { Copy, Trash2, Upload } from "lucide-react";

interface MediaItem { name: string; url: string; created_at?: string | null }

export const Route = createFileRoute("/_authenticated/admin/media")({
  head: () => ({ meta: [{ title: "Media — Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: Media,
});

function Media() {
  const [items, setItems] = useState<MediaItem[]>([]);

  async function load() {
    const { data } = await supabase.storage.from("media").list("hero", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    const { data: inline } = await supabase.storage.from("media").list("inline", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    const combine = [
      ...(data ?? []).map((f) => ({ name: `hero/${f.name}`, url: `/api/public/media/hero/${f.name}`, created_at: f.created_at })),
      ...(inline ?? []).map((f) => ({ name: `inline/${f.name}`, url: `/api/public/media/inline/${f.name}`, created_at: f.created_at })),
    ];
    setItems(combine);
  }
  useEffect(() => { load(); }, []);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      const path = `hero/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("media").upload(path, f);
      if (error) toast.error(error.message);
    }
    toast.success("Uploaded");
    load();
  }

  async function del(name: string) {
    if (!confirm("Delete this file?")) return;
    await supabase.storage.from("media").remove([name]);
    load();
  }

  return (
    <AdminShell title="Media library">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white">
        <Upload className="h-4 w-4" /> Upload images
        <input type="file" accept="image/*" multiple className="hidden" onChange={upload} />
      </label>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.length === 0 && <p className="col-span-full text-muted-foreground">No media uploaded.</p>}
        {items.map((m) => (
          <div key={m.name} className="overflow-hidden rounded-lg border border-border bg-background">
            <img src={m.url} alt="" className="aspect-video w-full object-cover" />
            <div className="flex items-center gap-1 p-2">
              <input readOnly value={m.url} className="min-w-0 flex-1 rounded bg-secondary px-2 py-1 text-xs" />
              <button onClick={() => { navigator.clipboard.writeText(m.url); toast.success("Copied"); }} className="rounded p-1.5 hover:bg-secondary"><Copy className="h-3.5 w-3.5" /></button>
              <button onClick={() => del(m.name)} className="rounded p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
