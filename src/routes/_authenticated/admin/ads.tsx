import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { toast } from "sonner";
import { Plus, Trash2, X, ExternalLink, Upload } from "lucide-react";
import { stripEmDashes } from "@/lib/strip-em-dashes";
import {
  PLACEMENT_LABELS,
  PLACEMENT_SPECS,
  sponsoredAdImageUrl,
  todayIso,
  type AdPlacement,
  type SponsoredAd,
} from "@/lib/sponsored-ads";

export const Route = createFileRoute("/_authenticated/admin/ads")({
  head: () => ({
    meta: [{ title: "Sponsored ads: Cognarah CMS" }, { name: "robots", content: "noindex" }],
  }),
  component: AdsAdmin,
});

type Draft = Partial<SponsoredAd> & { id?: string };

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const EMPTY: Draft = {
  advertiser_name: "",
  image_url: "",
  destination_url: "",
  placement: "startups_listing_top",
  start_date: todayIso(),
  end_date: plusDays(30),
  active: true,
};

function statusOf(ad: SponsoredAd): { label: string; className: string } {
  const today = todayIso();
  if (!ad.active) return { label: "Paused", className: "bg-secondary text-muted-foreground" };
  if (ad.start_date > today) return { label: "Scheduled", className: "bg-amber-100 text-amber-800" };
  if (ad.end_date < today) return { label: "Expired", className: "bg-secondary text-muted-foreground" };
  return { label: "Live", className: "bg-emerald-100 text-emerald-800" };
}

function AdsAdmin() {
  const [ads, setAds] = useState<SponsoredAd[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("sponsored_ads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setAds((data ?? []) as SponsoredAd[]);
  }
  useEffect(() => {
    load();
  }, []);

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("sponsored-ads").upload(path, file);
      if (error) {
        toast.error(error.message);
        return;
      }
      setEditing((e) => (e ? { ...e, image_url: `/api/public/sponsored-ads/${path}` } : e));
      toast.success("Image uploaded");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!editing) return;
    const advertiser = stripEmDashes(editing.advertiser_name ?? "").trim();
    const destination = (editing.destination_url ?? "").trim();
    if (!advertiser) {
      toast.error("Advertiser name is required");
      return;
    }
    if (!editing.image_url) {
      toast.error("Upload a banner image first");
      return;
    }
    if (!/^https?:\/\//i.test(destination)) {
      toast.error("Destination URL must start with http or https");
      return;
    }
    const start = editing.start_date ?? todayIso();
    const end = editing.end_date ?? plusDays(30);
    if (end < start) {
      toast.error("End date cannot be before the start date");
      return;
    }
    const payload = {
      advertiser_name: advertiser,
      image_url: editing.image_url,
      destination_url: destination,
      placement: (editing.placement ?? "startups_listing_top") as AdPlacement,
      start_date: start,
      end_date: end,
      active: editing.active ?? true,
    };
    setSaving(true);
    const { error } = editing.id
      ? await supabase.from("sponsored_ads").update(payload).eq("id", editing.id)
      : await supabase.from("sponsored_ads").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing.id ? "Ad updated" : "Ad created");
    setEditing(null);
    load();
  }

  async function toggleActive(ad: SponsoredAd) {
    const { error } = await supabase
      .from("sponsored_ads")
      .update({ active: !ad.active })
      .eq("id", ad.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  }

  async function remove(ad: SponsoredAd) {
    if (!confirm(`Delete the ad for ${ad.advertiser_name}?`)) return;
    const { error } = await supabase.from("sponsored_ads").delete().eq("id", ad.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ad deleted");
    load();
  }

  return (
    <AdminShell title="Sponsored ads" requiredRoles={["admin", "editor"]}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Banners run on the Startups and Funding listing pages and inline inside articles in those
          categories. Only ads that are active and inside their date range are shown to readers.
        </p>
        <div className="w-full rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground sm:w-auto">
          <p className="font-semibold text-foreground">Creative specs for clients</p>
          <p className="mt-1">
            Startups listing top: {PLACEMENT_SPECS.startups_listing_top.label}
          </p>
          <p>Article inline: {PLACEMENT_SPECS.article_inline.label}</p>
          <p className="mt-1">Export at the recommended width (or wider) as JPG or PNG.</p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> New ad
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Banner</th>
              <th className="px-4 py-3">Advertiser</th>
              <th className="px-4 py-3">Placement</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No sponsored ads yet.
                </td>
              </tr>
            )}
            {ads.map((ad) => {
              const s = statusOf(ad);
              return (
                <tr key={ad.id} className="border-t border-border align-middle">
                  <td className="px-4 py-3">
                    <img
                      src={sponsoredAdImageUrl(ad.image_url)}
                      alt=""
                      className="h-10 w-28 rounded object-cover"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{ad.advertiser_name}</td>
                  <td className="px-4 py-3">{PLACEMENT_LABELS[ad.placement]}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ad.start_date} to {ad.end_date}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={ad.destination_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                        aria-label="Open destination"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => toggleActive(ad)}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
                      >
                        {ad.active ? "Pause" : "Activate"}
                      </button>
                      <button
                        onClick={() => setEditing({ ...ad })}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(ad)}
                        className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                        aria-label="Delete ad"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="mt-10 w-full max-w-xl rounded-xl bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editing.id ? "Edit sponsored ad" : "New sponsored ad"}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="rounded p-1.5 hover:bg-secondary"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium">Advertiser name</label>
                <input
                  value={editing.advertiser_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, advertiser_name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Acme Ventures"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Banner image</label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Uploading" : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(f);
                      }}
                    />
                  </label>
                  {editing.image_url && (
                    <img
                      src={sponsoredAdImageUrl(editing.image_url)}
                      alt=""
                      className="h-12 w-36 rounded object-cover"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Destination URL</label>
                <input
                  value={editing.destination_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, destination_url: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Placement</label>
                <select
                  value={editing.placement ?? "startups_listing_top"}
                  onChange={(e) =>
                    setEditing({ ...editing, placement: e.target.value as AdPlacement })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="startups_listing_top">
                    {PLACEMENT_LABELS.startups_listing_top}
                  </option>
                  <option value="article_inline">{PLACEMENT_LABELS.article_inline}</option>
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Start date</label>
                  <input
                    type="date"
                    value={editing.start_date ?? todayIso()}
                    onChange={(e) => setEditing({ ...editing, start_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End date</label>
                  <input
                    type="date"
                    value={editing.end_date ?? plusDays(30)}
                    onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.active ?? true}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Active
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-md border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || uploading}
                className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving" : "Save ad"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
