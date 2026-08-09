import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  getPromotionQueue,
  generatePromotionCopy,
  logPromotion,
  listArticlePromotions,
  deletePromotion,
  backfillNewsworthiness,
} from "@/lib/promotion.functions";
import { SITE_URL } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { Megaphone, Sparkles, Copy, Check, Link2, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/promotion")({
  head: () => ({ meta: [{ title: "Promotion queue: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: PromotionPage,
});

/** Relative timestamps render after mount so SSR and client markup match. */
function RelativeTime({ iso, fallback }: { iso: string | null; fallback: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!iso) return <>{fallback}</>;
  return <>{mounted ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : format(new Date(iso), "MMM d, yyyy")}</>;
}

type Channel = "linkedin" | "x" | "whatsapp" | "newsletter";
const CHANNEL_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  x: "X",
  whatsapp: "WhatsApp",
  newsletter: "Newsletter",
  other: "Other",
};

function scoreTone(score: number) {
  if (score >= 75) return "bg-brand/15 text-brand";
  if (score >= 55) return "bg-africa/15 text-africa";
  if (score >= 35) return "bg-secondary text-foreground";
  return "bg-muted text-muted-foreground";
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        toast.success("Copied to clipboard");
        window.setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

function PromotionPanel({
  article,
  onLogged,
}: {
  article: { id: string; title: string; slug: string };
  onLogged: () => void;
}) {
  const genCopy = useServerFn(generatePromotionCopy);
  const doLog = useServerFn(logPromotion);
  const listPromos = useServerFn(listArticlePromotions);
  const removePromo = useServerFn(deletePromotion);
  const qc = useQueryClient();

  const [channel, setChannel] = useState<Channel>("linkedin");
  const [voice, setVoice] = useState<"cognarah" | "founder">("cognarah");
  const [campaign, setCampaign] = useState("organic");
  const [note, setNote] = useState("");
  const [copy, setCopy] = useState<string>("");
  const [link, setLink] = useState<string>("");

  const history = useQuery({
    queryKey: ["promotions", article.id],
    queryFn: () => listPromos({ data: { article_id: article.id } }),
  });

  const manualLink = useMemo(() => {
    const u = new URL(`${SITE_URL}/article/${article.slug}`);
    u.searchParams.set("utm_source", channel);
    u.searchParams.set("utm_medium", channel === "newsletter" ? "email" : "social");
    u.searchParams.set("utm_campaign", campaign.trim() || "organic");
    u.searchParams.set("utm_content", voice);
    return u.toString();
  }, [article.slug, channel, campaign, voice]);

  const generate = useMutation({
    mutationFn: () =>
      genCopy({ data: { article_id: article.id, channel, voice, campaign: campaign.trim() || "organic", note: note.trim() || null } }),
    onSuccess: (res: any) => {
      setCopy(res.copy);
      setLink(res.link);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not generate copy"),
  });

  const log = useMutation({
    mutationFn: () =>
      doLog({
        data: {
          article_id: article.id,
          channel,
          utm_source: channel,
          utm_medium: channel === "newsletter" ? "email" : "social",
          utm_campaign: campaign.trim() || "organic",
          utm_content: voice,
          note: copy ? copy.slice(0, 1000) : null,
        },
      }),
    onSuccess: () => {
      toast.success("Promotion logged");
      history.refetch();
      qc.invalidateQueries({ queryKey: ["promotion-queue"] });
      onLogged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not log promotion"),
  });

  return (
    <div className="border-t border-border bg-secondary/30 p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">
          <span className="text-xs text-muted-foreground">Channel</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="linkedin">LinkedIn</option>
            <option value="x">X</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="newsletter">Newsletter</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs text-muted-foreground">Voice</span>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value as "cognarah" | "founder")}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="cognarah">Cognarah brand</option>
            <option value="founder">Founder voice</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs text-muted-foreground">Campaign</span>
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            placeholder="organic"
          />
        </label>
        <label className="text-sm">
          <span className="text-xs text-muted-foreground">Angle note, optional</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            placeholder="Lead with the funding number"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy/90 disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {generate.isPending ? "Writing..." : "Generate copy"}
        </button>
        <CopyButton text={link || manualLink} label="Copy tracked link" />
        <a
          href={`${SITE_URL}/article/${article.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          <ExternalLink className="h-3.5 w-3.5" /> View article
        </a>
        <button
          type="button"
          onClick={() => log.mutate()}
          disabled={log.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
        >
          <Check className="h-3.5 w-3.5" /> Mark as promoted
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
        <Link2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{link || manualLink}</span>
      </div>

      {copy && (
        <div className="mt-3 rounded-md border border-border bg-background p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {CHANNEL_LABELS[channel]} copy, {voice === "founder" ? "founder voice" : "brand voice"}
            </span>
            <CopyButton text={copy} label="Copy post" />
          </div>
          <textarea
            value={copy}
            onChange={(e) => setCopy(e.target.value)}
            rows={Math.min(18, copy.split("\n").length + 3)}
            className="w-full resize-y rounded-md border border-border bg-background p-3 text-sm leading-relaxed"
          />
        </div>
      )}

      <div className="mt-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Distribution history</div>
        {history.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        ) : (history.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Not promoted anywhere yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-background text-sm">
            {(history.data as any[]).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <span className="font-medium">{CHANNEL_LABELS[p.channel] ?? p.channel}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {format(new Date(p.promoted_at), "MMM d, yyyy HH:mm")}
                    {p.utm_campaign ? `, campaign ${p.utm_campaign}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await removePromo({ data: { id: p.id } });
                    history.refetch();
                    qc.invalidateQueries({ queryKey: ["promotion-queue"] });
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                  aria-label="Delete promotion entry"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PromotionPage() {
  const fetchQueue = useServerFn(getPromotionQueue);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "never" | "high">("all");

  const runBackfill = useServerFn(backfillNewsworthiness);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["promotion-queue"],
    queryFn: () => fetchQueue(),
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => {
    const all = data ?? [];
    if (filter === "never") return all.filter((r) => r.promotions_count === 0);
    if (filter === "high") return all.filter((r) => r.promotion_score >= 55);
    return all;
  }, [data, filter]);

  return (
    <AdminShell title="Promotion queue" requiredRoles={["admin", "editor"]}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Published articles ranked by promotion score. The score blends newsworthiness, freshness, recent traction,
          African relevance, packaging and how often the piece has already been pushed.
        </p>
        <div className="flex gap-2">
          {(["all", "high", "never"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === f ? "bg-navy text-white" : "border border-border hover:bg-secondary"}`}
            >
              {f === "all" ? "All" : f === "high" ? "Score 55+" : "Never promoted"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => backfill.mutate({ data: { limit: 10 } })}
            disabled={backfill.isPending}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-60"
          >
            {backfill.isPending ? "Scoring..." : "Score missing articles"}
          </button>
        </div>
      </div>

      {isLoading && <div className="mt-6 rounded-lg border border-border bg-background p-6 text-sm text-muted-foreground">Building the queue...</div>}
      {error && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Could not load the queue: {(error as Error).message}
        </div>
      )}

      {data && rows.length === 0 && (
        <div className="mt-6 rounded-lg border border-border bg-background p-6 text-sm text-muted-foreground">
          Nothing in this view. Publish an article or change the filter.
        </div>
      )}

      <div className="mt-6 space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="overflow-hidden rounded-lg border border-border bg-background">
            <div className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreTone(r.promotion_score)}`}>
                    {r.promotion_score}/100
                  </span>
                  {r.category && <span className="text-xs text-muted-foreground">{r.category}</span>}
                  {r.promotions_count === 0 && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand">Never promoted</span>}
                  {r.promoted_channels.map((c) => (
                    <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{CHANNEL_LABELS[c] ?? c}</span>
                  ))}
                </div>
                <Link to="/admin/articles/$id" params={{ id: r.id }} className="mt-1 block font-medium hover:text-brand">
                  {r.title}
                </Link>
                <div className="mt-1 text-xs text-muted-foreground">
                  <RelativeTime iso={r.published_at} fallback="unpublished" />
                  {", "}
                  {r.view_count.toLocaleString()} views, {r.views_7d} in the last 7 days
                  {r.newsworthiness_score != null ? `, newsworthiness ${r.newsworthiness_score}/100` : ""}
                  {r.africa_relevance_score != null ? `, Africa ${r.africa_relevance_score}/5` : ""}
                </div>
                <p className="mt-2 text-sm">{r.promotion_reason}</p>
                {r.promotion_signals.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {r.promotion_signals.map((s) => (
                      <li key={s}>- {s}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpenId(openId === r.id ? null : r.id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
              >
                <Megaphone className="h-4 w-4" />
                {openId === r.id ? "Close" : "Promote"}
              </button>
            </div>
            {openId === r.id && <PromotionPanel article={r} onLogged={() => refetch()} />}
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
