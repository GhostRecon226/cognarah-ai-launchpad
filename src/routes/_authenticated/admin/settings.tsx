import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { toast } from "sonner";
import { backfillSanitization } from "@/lib/maintenance.functions";

interface Settings {
  id: number; site_name: string; tagline: string; logo_url: string | null;
  twitter: string | null; linkedin: string | null; facebook: string | null; instagram: string | null;
  newsletter_provider: string | null;
}

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [sanitizing, setSanitizing] = useState(false);
  const runBackfillSanitization = useServerFn(backfillSanitization);

  async function runSanitizationBackfill() {
    setSanitizing(true);
    try {
      const res = await runBackfillSanitization();
      toast.success(
        `Sanitized ${res.articles_changed}/${res.articles_scanned} articles, ` +
        `${res.translations_changed}/${res.translations_scanned} translations`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setSanitizing(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
      setS((data ?? null) as unknown as Settings | null);
    })();
  }, []);

  async function save() {
    if (!s) return;
    const { error } = await supabase.from("site_settings").update({
      site_name: s.site_name, tagline: s.tagline, logo_url: s.logo_url,
      twitter: s.twitter, linkedin: s.linkedin, facebook: s.facebook, instagram: s.instagram,
      newsletter_provider: s.newsletter_provider,
    }).eq("id", 1);
    if (error) toast.error(error.message); else toast.success("Saved");
  }

  if (!s) return <AdminShell title="Settings" requiredRoles={["admin"]}><p>Loading…</p></AdminShell>;

  const upd = (k: keyof Settings, v: string) => setS({ ...s, [k]: v });

  return (
    <AdminShell title="Settings" requiredRoles={["admin"]}>
      <div className="max-w-2xl space-y-4 rounded-lg border border-border bg-background p-6">
        <Field label="Site name" value={s.site_name} onChange={(v) => upd("site_name", v)} />
        <Field label="Tagline" value={s.tagline} onChange={(v) => upd("tagline", v)} />
        <Field label="Logo URL" value={s.logo_url ?? ""} onChange={(v) => upd("logo_url", v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Twitter URL" value={s.twitter ?? ""} onChange={(v) => upd("twitter", v)} />
          <Field label="LinkedIn URL" value={s.linkedin ?? ""} onChange={(v) => upd("linkedin", v)} />
          <Field label="Facebook URL" value={s.facebook ?? ""} onChange={(v) => upd("facebook", v)} />
          <Field label="Instagram URL" value={s.instagram ?? ""} onChange={(v) => upd("instagram", v)} />
        </div>
        <Field label="Newsletter provider (e.g. Mailchimp, Resend)" value={s.newsletter_provider ?? ""} onChange={(v) => upd("newsletter_provider", v)} />
        <button onClick={save} className="rounded-md bg-brand px-5 py-2 font-semibold text-white">Save settings</button>
      </div>

      <div className="mt-6 max-w-2xl space-y-2 rounded-lg border border-border bg-background p-6">
        <h2 className="text-sm font-semibold">Content sanitization backfill</h2>
        <p className="text-sm text-muted-foreground">
          Sanitizes existing article and translation bodies written before sanitization moved to write
          time. Safe to re-run; only changed rows get written.
        </p>
        <button
          onClick={runSanitizationBackfill}
          disabled={sanitizing}
          className="rounded-md border border-border bg-background px-5 py-2 font-semibold hover:bg-secondary disabled:opacity-60"
        >
          {sanitizing ? "Sanitizing…" : "Run sanitization backfill"}
        </button>
      </div>
    </AdminShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand" />
    </label>
  );
}
