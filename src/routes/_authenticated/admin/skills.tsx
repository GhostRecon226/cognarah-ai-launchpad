import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { toast } from "sonner";
import slugify from "slugify";
import { Trash2, Plus, ExternalLink, X } from "lucide-react";
import { stripEmDashes } from "@/lib/strip-em-dashes";

type Skill = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: "Claude Code" | "Prompt Engineering" | "Automation" | "Workflow" | "Other";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  content: string;
  file_url: string | null;
  author: string;
  published: boolean;
  created_at: string;
};

const CATEGORIES: Skill["category"][] = ["Claude Code", "Prompt Engineering", "Automation", "Workflow", "Other"];
const DIFFICULTIES: Skill["difficulty"][] = ["Beginner", "Intermediate", "Advanced"];

const EMPTY: Omit<Skill, "id" | "created_at"> = {
  slug: "",
  title: "",
  description: "",
  category: "Claude Code",
  difficulty: "Beginner",
  content: "",
  file_url: null,
  author: "Cognarah Team",
  published: false,
};

export const Route = createFileRoute("/_authenticated/admin/skills")({
  head: () => ({ meta: [{ title: "Skills: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: SkillsAdmin,
});

function SkillsAdmin() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [editing, setEditing] = useState<(Partial<Skill> & { id?: string }) | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const { data, error } = await supabase.from("skills").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setSkills((data ?? []) as Skill[]);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing({ ...EMPTY });
  }
  function openEdit(s: Skill) {
    setEditing({ ...s });
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("skills-files").upload(path, file);
      if (error) { toast.error(error.message); return; }
      setEditing((e) => e ? { ...e, file_url: `/api/public/skills-files/${path}` } : e);
      toast.success("File uploaded");
    } finally { setUploading(false); }
  }

  async function save() {
    if (!editing) return;
    const title = stripEmDashes(editing.title ?? "").trim();
    const description = stripEmDashes(editing.description ?? "").trim();
    const content = stripEmDashes(editing.content ?? "");
    if (!title || !description || !content) { toast.error("Title, description, and content are required"); return; }
    const slug = (editing.slug || slugify(title, { lower: true, strict: true })).trim();

    const payload = {
      title, description, content, slug,
      category: editing.category ?? "Claude Code",
      difficulty: editing.difficulty ?? "Beginner",
      file_url: editing.file_url ?? null,
      author: stripEmDashes(editing.author ?? "Cognarah Team"),
      published: !!editing.published,
    };

    if (editing.id) {
      const { error } = await supabase.from("skills").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("skills").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    setEditing(null);
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this skill?")) return;
    const { error } = await supabase.from("skills").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  async function togglePublished(s: Skill) {
    const { error } = await supabase.from("skills").update({ published: !s.published }).eq("id", s.id);
    if (error) toast.error(error.message); else load();
  }

  return (
    <AdminShell title="Skills" requiredRoles={["admin", "editor"]}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{skills.length} skill{skills.length === 1 ? "" : "s"}</p>
        <button onClick={openNew} className="inline-flex items-center gap-1 rounded bg-navy px-4 py-2 text-sm font-medium text-white">
          <Plus className="h-4 w-4" /> New skill
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">/{s.slug}</div>
                </td>
                <td className="px-4 py-3">{s.category}</td>
                <td className="px-4 py-3">{s.difficulty}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => togglePublished(s)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      s.published ? "bg-green-100 text-green-800" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {s.published ? "Published" : "Draft"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {s.published && (
                      <Link
                        to="/resources/skills/$slug"
                        params={{ slug: s.slug }}
                        target="_blank"
                        className="text-muted-foreground hover:text-brand"
                        aria-label="View"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    )}
                    <button onClick={() => openEdit(s)} className="rounded bg-secondary px-3 py-1 text-xs font-medium">Edit</button>
                    <button onClick={() => del(s.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {skills.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No skills yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="my-8 w-full max-w-3xl rounded-lg bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-bold">{editing.id ? "Edit skill" : "New skill"}</h2>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-6">
              <Field label="Title">
                <input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label="Slug (auto-generated if blank)">
                <input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="auto" className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label="Short description">
                <textarea value={editing.description ?? ""} rows={2} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Category">
                  <select value={editing.category ?? "Claude Code"} onChange={(e) => setEditing({ ...editing, category: e.target.value as Skill["category"] })} className="w-full rounded border border-border bg-white px-3 py-2 text-sm text-black">
                    {CATEGORIES.map((c) => <option key={c} value={c} className="bg-white text-black">{c}</option>)}
                  </select>
                </Field>
                <Field label="Difficulty">
                  <select value={editing.difficulty ?? "Beginner"} onChange={(e) => setEditing({ ...editing, difficulty: e.target.value as Skill["difficulty"] })} className="w-full rounded border border-border bg-white px-3 py-2 text-sm text-black">
                    {DIFFICULTIES.map((d) => <option key={d} value={d} className="bg-white text-black">{d}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Author">
                <input value={editing.author ?? "Cognarah Team"} onChange={(e) => setEditing({ ...editing, author: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label="Content (Markdown supported)">
                <textarea value={editing.content ?? ""} rows={12} onChange={(e) => setEditing({ ...editing, content: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-xs" placeholder="## Overview&#10;&#10;What this skill does..." />
              </Field>
              <Field label="Downloadable file (optional)">
                <div className="flex flex-wrap items-center gap-3">
                  <input type="file" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} disabled={uploading} className="text-sm" />
                  {editing.file_url && (
                    <div className="flex items-center gap-2 text-xs">
                      <a href={editing.file_url} target="_blank" rel="noopener noreferrer" className="text-brand underline">Current file</a>
                      <button onClick={() => setEditing({ ...editing, file_url: null })} className="text-muted-foreground hover:text-destructive">Remove</button>
                    </div>
                  )}
                </div>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editing.published} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} />
                Published
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <button onClick={() => setEditing(null)} className="rounded px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={save} className="rounded bg-brand px-4 py-2 text-sm font-semibold text-navy hover:bg-brand/90">Save</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
