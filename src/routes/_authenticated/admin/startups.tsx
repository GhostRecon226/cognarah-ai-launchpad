import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { MediaImage } from "@/components/site/media-image";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Check, X, ExternalLink, Sparkles, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateStartupDraft } from "@/lib/startup-submissions.functions";

export const Route = createFileRoute("/_authenticated/admin/startups")({
  head: () => ({ meta: [{ title: "Startup submissions: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: StartupsPage,
});

type Status = "pending" | "approved" | "rejected" | "published";

interface Submission {
  id: string;
  submitted_at: string;
  status: Status;
  admin_notes: string | null;
  company_name: string;
  website_url: string;
  country: string;
  city: string;
  year_founded: number;
  company_stage: string;
  product_description: string;
  problem_solved: string;
  target_audience: string;
  ai_technologies: string[];
  founder_name: string;
  founder_linkedin: string | null;
  team_size: string;
  user_count: string | null;
  revenue_stage: string;
  funding_raised: string | null;
  notable_investors: string | null;
  partnerships: string | null;
  logo_url: string;
  product_demo: string | null;
  press_links: string | null;
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
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const generateDraft = useServerFn(generateStartupDraft);


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


  return (
    <AdminShell title="Startup submissions" requiredRoles={["admin", "editor"]}>
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

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="hidden grid-cols-[1fr,1fr,1fr,1fr,1fr,auto,auto] gap-3 border-b border-border bg-secondary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
          <div>Company</div>
          <div>Founder</div>
          <div>Country</div>
          <div>Stage</div>
          <div>Submitted</div>
          <div>Status</div>
          <div className="pr-2 text-right">Actions</div>
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
                className="grid w-full grid-cols-1 items-center gap-2 px-4 py-3 text-left hover:bg-secondary md:grid-cols-[1fr,1fr,1fr,1fr,1fr,auto,auto] md:gap-3"
              >
                <div className="flex items-center gap-2 font-medium">
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{s.company_name}</span>
                </div>
                <div className="truncate text-sm text-muted-foreground md:text-foreground">{s.founder_name}</div>
                <div className="truncate text-sm text-muted-foreground">{s.country}, {s.city}</div>
                <div className="truncate text-sm text-muted-foreground">{s.company_stage}</div>
                <div className="truncate text-sm text-muted-foreground">{new Date(s.submitted_at).toLocaleDateString()}</div>
                <div><StatusBadge status={s.status} /></div>
                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => approve(s.id)}
                    disabled={s.status === "approved"}
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
                <div className="grid grid-cols-1 gap-6 border-t border-border bg-secondary/40 px-4 py-5 md:grid-cols-[160px,1fr]">
                  <div>
                    <MediaImage
                      src={s.logo_url}
                      alt={`${s.company_name} logo`}
                      className="h-40 w-40 rounded-md border border-border object-contain bg-white"
                      fallbackClassName="h-40 w-40 rounded-md"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Detail label="Website"><ExternalA href={s.website_url}>{s.website_url}</ExternalA></Detail>
                    <Detail label="Year founded">{s.year_founded}</Detail>
                    <Detail label="Team size">{s.team_size}</Detail>
                    <Detail label="Revenue stage">{s.revenue_stage}</Detail>
                    <Detail label="Users / customers">{s.user_count || "-"}</Detail>
                    <Detail label="Funding raised">{s.funding_raised || "-"}</Detail>
                    <Detail label="Notable investors">{s.notable_investors || "-"}</Detail>
                    <Detail label="Partnerships">{s.partnerships || "-"}</Detail>
                    <Detail label="Founder email"><a className="text-brand underline" href={`mailto:${s.founder_email}`}>{s.founder_email}</a></Detail>
                    <Detail label="Preferred contact">{s.contact_method}{s.contact_method === "WhatsApp" && s.whatsapp_number ? ` (${s.whatsapp_number})` : ""}</Detail>
                    <Detail label="Founder LinkedIn">{s.founder_linkedin ? <ExternalA href={s.founder_linkedin}>{s.founder_linkedin}</ExternalA> : "-"}</Detail>
                    <Detail label="Product demo">{s.product_demo ? <ExternalA href={s.product_demo}>{s.product_demo}</ExternalA> : "-"}</Detail>
                    <Detail label="AI technologies" full>{s.ai_technologies.join(", ") || "-"}</Detail>
                    <Detail label="Target audience" full>{s.target_audience}</Detail>
                    <Detail label="Product" full>{s.product_description}</Detail>
                    <Detail label="Problem solved" full>{s.problem_solved}</Detail>
                    {s.press_links && <Detail label="Press links" full><span className="whitespace-pre-wrap">{s.press_links}</span></Detail>}
                    {s.admin_notes && <Detail label="Admin notes" full><span className="whitespace-pre-wrap">{s.admin_notes}</span></Detail>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AdminShell>
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
