import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/admin-shell";
import { toast } from "sonner";
import { format } from "date-fns";
import { Sparkles, Play, Plus, Trash2, RefreshCw } from "lucide-react";
import {
  getAgentSettings,
  updateAgentSettings,
  listAgentSources,
  addAgentSource,
  toggleAgentSource,
  deleteAgentSource,
  listAgentRuns,
  runAgent,
  runSkillsAgent,
} from "@/lib/agent.functions";

export const Route = createFileRoute("/_authenticated/admin/agent")({
  head: () => ({ meta: [{ title: "AI Agent: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: AgentPage,
});

function AgentPage() {
  return (
    <AdminShell title="AI News Agent" requiredRoles={["admin", "editor"]}>
      <AgentInner />
    </AdminShell>
  );
}

interface Settings {
  enabled: boolean;
  cron_expression: string;
  default_count: number;
  default_focus: string | null;
  system_prompt: string | null;
  search_time_window: "qdr:h" | "qdr:d" | "qdr:w" | "qdr:m" | "qdr:y";
  query_presets: string[];
}

interface Source { id: string; label: string; kind: string; value: string; enabled: boolean }
interface Run {
  id: string; trigger: string; status: string; requested_count: number; drafts_created: number;
  focus: string | null; error: string | null; log: string | null; started_at: string; finished_at: string | null;
}

function AgentInner() {
  const _getSettings = useServerFn(getAgentSettings);
  const _updateSettings = useServerFn(updateAgentSettings);
  const _listSources = useServerFn(listAgentSources);
  const _addSource = useServerFn(addAgentSource);
  const _toggleSource = useServerFn(toggleAgentSource);
  const _deleteSource = useServerFn(deleteAgentSource);
  const _listRuns = useServerFn(listAgentRuns);
  const _runAgent = useServerFn(runAgent);
  const _runSkillsAgent = useServerFn(runSkillsAgent);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [running, setRunning] = useState(false);
  const [runningSkills, setRunningSkills] = useState(false);
  const [count, setCount] = useState(2);
  const [skillsCount, setSkillsCount] = useState(2);
  const [focus, setFocus] = useState("");
  const [newSrc, setNewSrc] = useState({ label: "", kind: "domain" as "domain" | "rss" | "url" | "skill_url", value: "" });
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [presetsText, setPresetsText] = useState("");

  async function loadAll() {
    try {
      const [s, src, r] = await Promise.all([_getSettings(), _listSources(), _listRuns()]);
      const raw = (s ?? {}) as Partial<Settings>;
      const normalized: Settings = {
        enabled: !!raw.enabled,
        cron_expression: raw.cron_expression ?? "0 7 * * *",
        default_count: raw.default_count ?? 2,
        default_focus: raw.default_focus ?? null,
        system_prompt: raw.system_prompt ?? null,
        search_time_window: (raw.search_time_window as Settings["search_time_window"]) ?? "qdr:w",
        query_presets: Array.isArray(raw.query_presets) ? raw.query_presets : [],
      };
      setSettings(normalized);
      setPresetsText(normalized.query_presets.join("\n"));
      setSources(src as Source[]);
      setRuns(r as Run[]);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load agent data");
    }
  }
  useEffect(() => { loadAll(); }, []);

  async function saveSettings() {
    if (!settings) return;
    try {
      const query_presets = presetsText.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20);
      await _updateSettings({ data: { ...settings, query_presets } });
      setSettings({ ...settings, query_presets });
      toast.success("Settings saved");
    } catch (e: any) { toast.error(e?.message); }
  }


  async function doRun() {
    setRunning(true);
    toast.info(`Agent running, generating up to ${count} draft(s)…`);
    try {
      const res: any = await _runAgent({ data: { count, focus: focus || null } });
      toast.success(`${res.drafts_created} draft(s) created. Review in Articles.`);
      loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Run failed");
      loadAll();
    } finally {
      setRunning(false);
    }
  }

  async function doRunSkills() {
    setRunningSkills(true);
    toast.info(`Skills agent running, importing up to ${skillsCount} skill draft(s)…`);
    try {
      const res: any = await _runSkillsAgent({ data: { count: skillsCount } });
      toast.success(`${res.drafts_created} skill draft(s) created. Review in Skills.`);
      loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Skills run failed");
      loadAll();
    } finally {
      setRunningSkills(false);
    }
  }

  async function addSrc() {
    if (!newSrc.label || !newSrc.value) return;
    try {
      await _addSource({ data: newSrc });
      setNewSrc({ label: "", kind: "domain", value: "" });
      const src = await _listSources();
      setSources(src as Source[]);
    } catch (e: any) { toast.error(e?.message); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Run panel */}
      <section className="rounded-lg border border-border bg-background p-5 lg:col-span-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-semibold">Generate drafts now</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          The agent searches the web for fresh AI news, rewrites in Cognarah's editorial voice, attaches a hero image, and saves as <strong>draft</strong>. Nothing publishes until you approve it.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Number of drafts
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-sm">
              <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">Topic focus (optional)
            <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. African AI startups, LLM regulation, open source models" className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm" />
          </label>
        </div>
        <button disabled={running} onClick={doRun} className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Running…" : "Run agent"}
        </button>
      </section>

      {/* Skills Mode panel */}
      <section className="rounded-lg border border-border bg-background p-5 lg:col-span-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-semibold">Import skills now</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          The agent fetches configured <code>skill_url</code> sources, extracts a self-contained skill in Cognarah's voice, preserves the original creator's name and source URL, and saves as a <strong>draft</strong> in the Skills library.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Number of skill drafts
            <select value={skillsCount} onChange={(e) => setSkillsCount(Number(e.target.value))} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-sm">
              <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={5}>5</option>
            </select>
          </label>
          <div className="text-xs text-muted-foreground sm:col-span-2 self-end">
            Add candidate URLs below under <em>Trusted sources</em> with kind <code>skill_url</code>. Each URL is imported only once.
          </div>
        </div>
        <button disabled={runningSkills} onClick={doRunSkills} className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
          {runningSkills ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {runningSkills ? "Importing…" : "Run skills agent"}
        </button>
      </section>


      {/* Schedule */}
      <section className="rounded-lg border border-border bg-background p-5">
        <h2 className="text-lg font-semibold">Schedule</h2>
        {!settings ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p> : (
          <div className="mt-3 space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
              Enable scheduled runs
            </label>
            <label className="block">Cron expression
              <input value={settings.cron_expression} onChange={(e) => setSettings({ ...settings, cron_expression: e.target.value })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs" />
              <span className="text-xs text-muted-foreground">e.g. <code>0 7 * * *</code> = daily 7am UTC. Requires cron job set up separately (see below).</span>
            </label>
            <label className="block">Drafts per scheduled run
              <input type="number" min={1} max={3} value={settings.default_count} onChange={(e) => setSettings({ ...settings, default_count: Number(e.target.value) })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm" />
            </label>
            <label className="block">Default topic focus
              <input value={settings.default_focus ?? ""} onChange={(e) => setSettings({ ...settings, default_focus: e.target.value })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm" placeholder="artificial intelligence" />
            </label>
            <label className="block">Search time window
              <select value={settings.search_time_window} onChange={(e) => setSettings({ ...settings, search_time_window: e.target.value as Settings["search_time_window"] })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
                <option value="qdr:h">Past hour</option>
                <option value="qdr:d">Past day</option>
                <option value="qdr:w">Past week</option>
                <option value="qdr:m">Past month</option>
                <option value="qdr:y">Past year</option>
              </select>
              <span className="text-xs text-muted-foreground">How fresh search results must be.</span>
            </label>
            <label className="block">Query presets
              <textarea rows={5} value={presetsText} onChange={(e) => setPresetsText(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs" placeholder={"One query per line.\nUse {focus} to inject the topic focus.\nExample:\n{focus} enterprise deployment\nAfrican AI startup raise"} />
              <span className="text-xs text-muted-foreground">Overrides the default query set. Leave empty to use built-in queries.</span>
            </label>
            <button onClick={saveSettings} className="w-full rounded-md bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy/90">Save settings</button>

          </div>
        )}
      </section>

      {/* Sources */}
      <section className="rounded-lg border border-border bg-background p-5 lg:col-span-2">
        <h2 className="text-lg font-semibold">Trusted sources</h2>
        <p className="mt-1 text-sm text-muted-foreground">Domains the agent prioritizes when searching. Broad web search still runs on top.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto]">
          <input placeholder="Label" value={newSrc.label} onChange={(e) => setNewSrc({ ...newSrc, label: e.target.value })} className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
          <select value={newSrc.kind} onChange={(e) => setNewSrc({ ...newSrc, kind: e.target.value as any })} className="rounded border border-border bg-background px-2 py-1.5 text-sm">
            <option value="domain">domain</option><option value="rss">rss</option><option value="url">url</option><option value="skill_url">skill_url</option>
          </select>
          <input placeholder={newSrc.kind === "skill_url" ? "https://example.com/skill-guide" : "techcrunch.com"} value={newSrc.value} onChange={(e) => setNewSrc({ ...newSrc, value: e.target.value })} className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
          <button onClick={addSrc} className="inline-flex items-center gap-1 rounded bg-navy px-3 py-1.5 text-sm text-white"><Plus className="h-4 w-4" /> Add</button>
        </div>
        <ul className="mt-4 divide-y divide-border text-sm">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <div>
                <span className={`font-medium ${s.enabled ? "" : "opacity-50 line-through"}`}>{s.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{s.kind} · {s.value}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={s.enabled} onChange={async (e) => { await _toggleSource({ data: { id: s.id, enabled: e.target.checked } }); const src = await _listSources(); setSources(src as Source[]); }} /> on
                </label>
                <button onClick={async () => { if (!confirm("Delete source?")) return; await _deleteSource({ data: { id: s.id } }); const src = await _listSources(); setSources(src as Source[]); }} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
          {sources.length === 0 && <li className="py-6 text-center text-muted-foreground">No sources yet.</li>}
        </ul>
      </section>

      {/* Runs */}
      <section className="rounded-lg border border-border bg-background p-5 lg:col-span-3">
        <h2 className="text-lg font-semibold">Recent runs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="py-2">Started</th><th>Trigger</th><th>Focus</th><th>Status</th><th>Drafts</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td className="py-2">{format(new Date(r.started_at), "MMM d, HH:mm")}</td>
                    <td>{r.trigger}</td>
                    <td className="text-muted-foreground">{r.focus ?? "None"}</td>
                    <td>
                      <span className={`inline-block rounded px-2 py-0.5 text-xs ${r.status === "success" ? "bg-emerald-100 text-emerald-700" : r.status === "error" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{r.status}</span>
                    </td>
                    <td>{r.drafts_created} / {r.requested_count}</td>
                    <td><button onClick={() => setExpandedRun(expandedRun === r.id ? null : r.id)} className="text-xs text-brand hover:underline">{expandedRun === r.id ? "hide" : "log"}</button></td>
                  </tr>
                  {expandedRun === r.id && (
                    <tr>
                      <td colSpan={6} className="bg-secondary/40 p-3">
                        {r.error && <div className="mb-2 text-xs text-rose-700">Error: {r.error}</div>}
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{r.log || "(no log)"}</pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {runs.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No runs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
