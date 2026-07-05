import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { toast } from "sonner";
import slugify from "slugify";
import type { Author } from "@/lib/types";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/authors")({
  head: () => ({ meta: [{ title: "Authors: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: AuthorsAdmin,
});

function AuthorsAdmin() {
  const [list, setList] = useState<Author[]>([]);
  const [newName, setNewName] = useState("");

  async function load() {
    const { data } = await supabase.from("authors").select("*").order("name");
    setList((data ?? []) as unknown as Author[]);
  }
  useEffect(() => { load(); }, []);

  async function save(a: Author) {
    const { error } = await supabase.from("authors").update({
      name: a.name, slug: a.slug, bio: a.bio, photo_url: a.photo_url, twitter: a.twitter, linkedin: a.linkedin, website: a.website,
    }).eq("id", a.id);
    if (error) toast.error(error.message); else toast.success("Saved");
  }
  async function add() {
    if (!newName) return;
    const slug = slugify(newName, { lower: true, strict: true });
    const { error } = await supabase.from("authors").insert({ name: newName, slug });
    if (error) toast.error(error.message); else { setNewName(""); load(); }
  }
  async function del(id: string) {
    if (!confirm("Delete this author?")) return;
    await supabase.from("authors").delete().eq("id", id);
    load();
  }

  return (
    <AdminShell title="Authors" requiredRoles={["admin", "editor"]}>
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex gap-2">
          <input placeholder="Author name" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={add} className="inline-flex items-center gap-1 rounded bg-navy px-4 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" /> Add</button>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {list.map((a) => (
          <div key={a.id} className="rounded-lg border border-border bg-background p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <input value={a.name} placeholder="Name" onChange={(e) => setList(l => l.map(x => x.id === a.id ? { ...x, name: e.target.value } : x))} className="rounded border border-border bg-background px-2 py-1.5 text-sm font-semibold" />
              <input value={a.photo_url ?? ""} placeholder="Photo URL" onChange={(e) => setList(l => l.map(x => x.id === a.id ? { ...x, photo_url: e.target.value } : x))} className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
              <textarea value={a.bio ?? ""} placeholder="Bio" rows={2} onChange={(e) => setList(l => l.map(x => x.id === a.id ? { ...x, bio: e.target.value } : x))} className="md:col-span-2 rounded border border-border bg-background px-2 py-1.5 text-sm" />
              <input value={a.twitter ?? ""} placeholder="Twitter URL" onChange={(e) => setList(l => l.map(x => x.id === a.id ? { ...x, twitter: e.target.value } : x))} className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
              <input value={a.linkedin ?? ""} placeholder="LinkedIn URL" onChange={(e) => setList(l => l.map(x => x.id === a.id ? { ...x, linkedin: e.target.value } : x))} className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
              <input value={a.website ?? ""} placeholder="Website" onChange={(e) => setList(l => l.map(x => x.id === a.id ? { ...x, website: e.target.value } : x))} className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => save(a)} className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white">Save</button>
              <button onClick={() => del(a.id)} className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
