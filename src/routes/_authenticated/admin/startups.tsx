import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { MediaImage } from "@/components/site/media-image";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Check, X, ExternalLink, Sparkles, Eye, Loader2, Mail, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateStartupDraft } from "@/lib/startup-submissions.functions";

export const Route = createFileRoute("/_authenticated/admin/startups")({
  head: () => ({ meta: [{ title: "Startup submissions: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: StartupsPage,
});

type Status = "pending" | "approved" | "rejected" | "published";

interface Cofounder { name?: string; role?: string; linkedin?: string }

interface Submission {
  id: string;
  submitted_at: string;
  status: Status;
  admin_notes: string | null;
  company_name: string;
  tagline: string | null;
  website_url: string;
  company_linkedin: string | null;
  twitter_handle: string | null;
  youtube_url: string | null;
  country: string;
  city: string;
  year_founded: number;
  company_stage: string;
  product_description: string;
  problem_solved: string;
  mission: string | null;
  differentiator: string | null;
  competitors: string | null;
  business_model: string | null;
  pricing_model: string | null;
  markets_served: string[] | null;
  target_audience: string;
  ai_technologies: string[];
  founder_name: string;
  founder_linkedin: string | null;
  cofounders: Cofounder[] | null;
  key_team_members: string | null;
  team_size: string;
  user_count: string | null;
  revenue_stage: string;
  funding_raised: string | null;
  notable_investors: string | null;
  partnerships: string | null;
  milestones: string | null;
  awards: string | null;
  logo_url: string;
  screenshot_urls: string[] | null;
  product_demo: string | null;
  pitch_video_url: string | null;
  press_links: string | null;
  roadmap: string | null;
  founder_email: string;
  contact_method: string;
  whatsapp_number: string | null;
  article_id: string | null;
}

const STATUS_STYLES: Record<Status, string> = {
  pending: "bg-yellow-100 text-yellow-900 border-yellow-300",
  approved: "bg-green-100 text-green-900 border-green-300",
  rejected: "bg-red-100 text-red-900 border-red-300",
  published: "bg-purple-100 text-purple-900 border-purple-300",
};

const STATUS_FILTERS: (Status | "all")[] = ["all", "pending", "approved", "rejected", "published"];

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize", STATUS_STYLES[status])}>
      {status}
    </span>
  );
}

function StartupsPage() {
  return (
    <AdminShell title="Startup submissions" requiredRoles={["admin", "editor"]}>
      <StartupsTable />
    </AdminShell>
  );
}

const COLS =
  "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_100px_368px]";

function StartupsTable() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const generateDraft = useServerFn(generateStartupDraft);
  const { hasRole } = useRoles();
  const canDelete = hasRole("admin");



  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("startup_submissions")
      .select("*")
      .order("submitted_at", { ascending: false });
    if (error) toast.error(error.message);
    setSubs((data ?? []) as Submission[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => filter === "all" ? subs : subs.filter((s) => s.status === filter), [subs, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: subs.length, pending: 0, approved: 0, rejected: 0, published: 0 };
    for (const s of subs) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [subs]);

  async function updateStatus(id: string, status: Status, notes?: string) {
    const payload: { status: Status; admin_notes?: string } = { status };
    if (notes !== undefined) payload.admin_notes = notes;
    const { error } = await supabase.from("startup_submissions").update(payload).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Submission ${status}`);
    setSubs((prev) => prev.map((s) => s.id === id ? { ...s, status, admin_notes: notes ?? s.admin_notes } : s));
  }

  function approve(id: string) {
    updateStatus(id, "approved");
  }

  function reject(id: string) {
    const reason = window.prompt("Reason for rejection (saved to admin notes):");
    if (reason === null) return;
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    updateStatus(id, "rejected", reason.trim());
  }

  async function generate(id: string) {
    if (generating.has(id)) return;
    setGenerating((prev) => new Set(prev).add(id));
    const t = toast.loading("Generating startup profile draft...");
    try {
      const res = await generateDraft({ data: { submission_id: id } });
      toast.success(`Draft created${res.refined ? " (refined by Claude)" : ""}`, { id: t });
      setSubs((prev) => prev.map((s) => s.id === id ? { ...s, status: "published", article_id: res.article_id } : s));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Draft generation failed", { id: t });
    } finally {
      setGenerating((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function remove(s: Submission) {
    const ok = window.confirm(
      `Delete the submission from ${s.company_name}? This cannot be undone.${s.article_id ? " Any article already generated from it stays in place." : ""}`,
    );
    if (!ok) return;
    const { error } = await supabase.from("startup_submissions").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Submission deleted");
    setSubs((prev) => prev.filter((x) => x.id !== s.id));
    setExpanded((prev) => (prev === s.id ? null : prev));
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium capitalize transition",
              filter === f
                ? "border-navy bg-navy text-white"
                : "border-border bg-background text-muted-foreground hover:bg-secondary",
            )}
          >
            {f} <span className="ml-1 opacity-70">({counts[f] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-background">
       <div className="md:min-w-[1180px]">
        <div className={cn("hidden gap-3 border-b border-border bg-secondary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid", COLS)}>
          <div className="min-w-0">Company</div>
          <div className="min-w-0">Founder</div>
          <div className="min-w-0">Country</div>
          <div className="min-w-0">Stage</div>
          <div className="min-w-0">Submitted</div>
          <div>Status</div>
          <div className="text-right">Actions</div>
        </div>


        {loading && <p className="px-4 py-6 text-sm text-muted-foreground">Loading submissions...</p>}
        {!loading && visible.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">No submissions match this filter.</p>
        )}

        {visible.map((s) => {
          const isOpen = expanded === s.id;
          return (
            <div key={s.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : s.id)}
                className={cn("grid w-full grid-cols-1 items-center gap-2 px-4 py-3 text-left hover:bg-secondary md:gap-3", COLS)}
              >
                <div className="flex min-w-0 items-center gap-2 font-medium">
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{s.company_name}</span>
                </div>
                <div className="min-w-0 truncate text-sm text-muted-foreground md:text-foreground">{s.founder_name}</div>
                <div className="min-w-0 truncate text-sm text-muted-foreground">{s.country}, {s.city}</div>
                <div className="min-w-0 truncate text-sm text-muted-foreground">{s.company_stage}</div>
                <div className="min-w-0 truncate text-sm text-muted-foreground">{new Date(s.submitted_at).toLocaleDateString()}</div>
                <div><StatusBadge status={s.status} /></div>
                <div className="flex flex-wrap items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>

                  <Link
                    to="/admin/email-preview/startup-submission/$id"
                    params={{ id: s.id }}
                    title="Preview notification email"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                  >
                    <Mail className="h-3.5 w-3.5" /> Preview email
                  </Link>
                  {s.article_id ? (
                    <Link
                      to="/admin/articles/$id"
                      params={{ id: s.article_id }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-800 hover:bg-purple-100"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Article
                    </Link>
                  ) : s.status === "approved" ? (
                    <button
                      onClick={() => generate(s.id)}
                      disabled={generating.has(s.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-navy bg-navy px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-60"
                    >
                      {generating.has(s.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {generating.has(s.id) ? "Generating..." : "Generate Draft"}
                    </button>
                  ) : null}
                  <button
                    onClick={() => approve(s.id)}
                    disabled={s.status === "approved" || s.status === "published"}
                    title="Approve"
                    className="rounded-md border border-green-300 bg-green-50 p-1.5 text-green-700 hover:bg-green-100 disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => reject(s.id)}
                    disabled={s.status === "rejected"}
                    title="Reject"
                    className="rounded-md border border-red-300 bg-red-50 p-1.5 text-red-700 hover:bg-red-100 disabled:opacity-40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </button>

              {isOpen && (
                <div className="grid grid-cols-1 gap-6 border-t border-border bg-secondary/40 px-4 py-5 md:grid-cols-[160px_1fr]">
                  <div className="space-y-3">
                    <MediaImage
                      src={s.logo_url}
                      alt={`${s.company_name} logo`}
                      className="h-40 w-40 rounded-md border border-border object-contain bg-white"
                      fallbackClassName="h-40 w-40 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => copyDetails(s)}
                      className="inline-flex w-40 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy all details
                    </button>
                    {s.screenshot_urls && s.screenshot_urls.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Screenshots</div>
                        {s.screenshot_urls.map((u, i) => (
                          <MediaImage
                            key={i}
                            src={u}
                            alt={`Screenshot ${i + 1}`}
                            className="h-24 w-40 rounded border border-border object-cover bg-white"
                            fallbackClassName="h-24 w-40 rounded"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {s.tagline && <Detail label="Tagline" full>{s.tagline}</Detail>}
                    <Detail label="Website"><ExternalA href={s.website_url}>{s.website_url}</ExternalA></Detail>
                    <Detail label="Year founded">{s.year_founded}</Detail>
                    <Detail label="Headquarters">{s.city}, {s.country}</Detail>
                    <Detail label="Company stage">{s.company_stage}</Detail>
                    <Detail label="Team size">{s.team_size}</Detail>
                    <Detail label="Revenue stage">{s.revenue_stage}</Detail>
                    <Detail label="Users / customers">{s.user_count || "-"}</Detail>
                    <Detail label="Funding raised">{s.funding_raised || "-"}</Detail>
                    <Detail label="Business model">{s.business_model || "-"}</Detail>
                    <Detail label="Pricing model">{s.pricing_model || "-"}</Detail>
                    <Detail label="Notable investors">{s.notable_investors || "-"}</Detail>
                    <Detail label="Partnerships / clients">{s.partnerships || "-"}</Detail>
                    <Detail label="Company LinkedIn">{s.company_linkedin ? <ExternalA href={s.company_linkedin}>{s.company_linkedin}</ExternalA> : "-"}</Detail>
                    <Detail label="Twitter / X">{s.twitter_handle || "-"}</Detail>
                    <Detail label="YouTube">{s.youtube_url ? <ExternalA href={s.youtube_url}>{s.youtube_url}</ExternalA> : "-"}</Detail>
                    <Detail label="Founder email"><a className="text-brand underline" href={`mailto:${s.founder_email}`}>{s.founder_email}</a></Detail>
                    <Detail label="Preferred contact">{s.contact_method}{s.contact_method === "WhatsApp" && s.whatsapp_number ? ` (${s.whatsapp_number})` : ""}</Detail>
                    <Detail label="Founder LinkedIn">{s.founder_linkedin ? <ExternalA href={s.founder_linkedin}>{s.founder_linkedin}</ExternalA> : "-"}</Detail>
                    <Detail label="Product demo">{s.product_demo ? <ExternalA href={s.product_demo}>{s.product_demo}</ExternalA> : "-"}</Detail>
                    <Detail label="Pitch video">{s.pitch_video_url ? <ExternalA href={s.pitch_video_url}>{s.pitch_video_url}</ExternalA> : "-"}</Detail>
                    <Detail label="Markets served" full>{s.markets_served && s.markets_served.length > 0 ? s.markets_served.join(", ") : "-"}</Detail>
                    <Detail label="AI technologies" full>{s.ai_technologies.join(", ") || "-"}</Detail>
                    <Detail label="Target audience" full>{s.target_audience}</Detail>
                    <Detail label="What the product does" full><span className="whitespace-pre-wrap">{s.product_description}</span></Detail>
                    <Detail label="Problem it solves" full><span className="whitespace-pre-wrap">{s.problem_solved}</span></Detail>
                    {s.mission && <Detail label="Mission" full><span className="whitespace-pre-wrap">{s.mission}</span></Detail>}
                    {s.differentiator && <Detail label="What makes them different" full><span className="whitespace-pre-wrap">{s.differentiator}</span></Detail>}
                    {s.competitors && <Detail label="Competitors" full><span className="whitespace-pre-wrap">{s.competitors}</span></Detail>}
                    {s.cofounders && s.cofounders.length > 0 && (
                      <Detail label="Co-founders" full>
                        <ul className="list-disc pl-4 space-y-1">
                          {s.cofounders.map((c, i) => (
                            <li key={i}>
                              <span className="font-medium">{c.name || "Unnamed"}</span>
                              {c.role ? ` - ${c.role}` : ""}
                              {c.linkedin ? <> {" "}<ExternalA href={c.linkedin}>LinkedIn</ExternalA></> : null}
                            </li>
                          ))}
                        </ul>
                      </Detail>
                    )}
                    {s.key_team_members && <Detail label="Key team members" full><span className="whitespace-pre-wrap">{s.key_team_members}</span></Detail>}
                    {s.milestones && <Detail label="Milestones" full><span className="whitespace-pre-wrap">{s.milestones}</span></Detail>}
                    {s.awards && <Detail label="Awards / recognition" full><span className="whitespace-pre-wrap">{s.awards}</span></Detail>}
                    {s.roadmap && <Detail label="Roadmap / what's next" full><span className="whitespace-pre-wrap">{s.roadmap}</span></Detail>}
                    {s.press_links && <Detail label="Press coverage" full><span className="whitespace-pre-wrap">{s.press_links}</span></Detail>}
                    {s.admin_notes && <Detail label="Admin notes" full><span className="whitespace-pre-wrap">{s.admin_notes}</span></Detail>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
       </div>
      </div>
    </>
  );

}

function Detail({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn(full && "sm:col-span-2")}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm text-foreground break-words">{children}</div>
    </div>
  );
}

function ExternalA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand underline">
      <span className="break-all">{children}</span>
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}

function copyDetails(s: Submission) {
  const yes = (v: unknown) => (v === null || v === undefined || v === "" ? "-" : String(v));
  const co = s.cofounders && s.cofounders.length > 0
    ? s.cofounders.map((c) => `  - ${c.name || "Unnamed"}${c.role ? ` (${c.role})` : ""}${c.linkedin ? ` ${c.linkedin}` : ""}`).join("\n")
    : "-";
  const parts = [
    `Company: ${s.company_name}`,
    `Tagline: ${yes(s.tagline)}`,
    `Website: ${s.website_url}`,
    `Company LinkedIn: ${yes(s.company_linkedin)}`,
    `Twitter/X: ${yes(s.twitter_handle)}`,
    `YouTube: ${yes(s.youtube_url)}`,
    `HQ: ${s.city}, ${s.country}`,
    `Markets served: ${yes(s.markets_served?.join(", "))}`,
    `Year founded: ${s.year_founded}`,
    `Company stage: ${s.company_stage}`,
    `AI technologies: ${s.ai_technologies.join(", ")}`,
    `Target audience: ${s.target_audience}`,
    ``,
    `WHAT THE PRODUCT DOES:\n${s.product_description}`,
    ``,
    `PROBLEM SOLVED:\n${s.problem_solved}`,
    ``,
    `MISSION:\n${yes(s.mission)}`,
    ``,
    `DIFFERENTIATOR:\n${yes(s.differentiator)}`,
    ``,
    `COMPETITORS: ${yes(s.competitors)}`,
    `BUSINESS MODEL: ${yes(s.business_model)}`,
    `PRICING MODEL: ${yes(s.pricing_model)}`,
    ``,
    `TEAM`,
    `Founder: ${s.founder_name}${s.founder_linkedin ? ` (${s.founder_linkedin})` : ""}`,
    `Team size: ${s.team_size}`,
    `Co-founders:\n${co}`,
    `Key team members: ${yes(s.key_team_members)}`,
    ``,
    `TRACTION`,
    `Users / customers: ${yes(s.user_count)}`,
    `Revenue stage: ${s.revenue_stage}`,
    `Funding raised: ${yes(s.funding_raised)}`,
    `Notable investors: ${yes(s.notable_investors)}`,
    `Partnerships: ${yes(s.partnerships)}`,
    `Milestones: ${yes(s.milestones)}`,
    `Awards: ${yes(s.awards)}`,
    ``,
    `MEDIA`,
    `Logo: ${s.logo_url}`,
    `Screenshots: ${yes(s.screenshot_urls?.join(", "))}`,
    `Product demo: ${yes(s.product_demo)}`,
    `Pitch video: ${yes(s.pitch_video_url)}`,
    `Press links: ${yes(s.press_links)}`,
    ``,
    `ROADMAP: ${yes(s.roadmap)}`,
    ``,
    `CONTACT`,
    `Email: ${s.founder_email}`,
    `Preferred: ${s.contact_method}${s.contact_method === "WhatsApp" && s.whatsapp_number ? ` (${s.whatsapp_number})` : ""}`,
  ];
  const text = parts.join("\n");
  navigator.clipboard.writeText(text).then(
    () => toast.success("Details copied to clipboard"),
    () => toast.error("Copy failed"),
  );
}
