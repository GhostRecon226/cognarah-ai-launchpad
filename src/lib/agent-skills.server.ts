// Server-only: Skills mode for the AI agent.
// Fetches configured skill source URLs, extracts a structured skill draft,
// and inserts into the skills table with published=false.
import Firecrawl from "@mendable/firecrawl-js";
import slugify from "slugify";
import { createHash } from "crypto";
import { stripEmDashes } from "./strip-em-dashes";

type Sb = any;

interface RunSkillsArgs {
  supabase: Sb;
  triggeredBy: string | null;
  trigger: "manual" | "scheduled";
  count: number;
}

const CATEGORIES = ["Claude Code", "Prompt Engineering", "Automation", "Workflow", "Other"] as const;
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;
type SkillCategory = (typeof CATEGORIES)[number];
type SkillDifficulty = (typeof DIFFICULTIES)[number];

interface SkillDraft {
  title: string;
  description: string;
  category: SkillCategory;
  difficulty: SkillDifficulty;
  content: string; // markdown
  author: string; // creator name
}

function hashUrl(url: string) {
  return createHash("sha256").update(url.trim().toLowerCase()).digest("hex");
}

const SKILLS_SYSTEM_PROMPT =
  "You are the Skills extraction agent for Cognarah, an African-first AI media publication. " +
  "You receive the scraped content of a single web page describing an AI-related skill, guide, tutorial, prompt, or workflow. " +
  "Your job is to convert it into a clean, self-contained skill entry for the Cognarah Skills library.\n\n" +
  "RULES\n" +
  "- Preserve the original author's voice and factual content. Do not invent facts.\n" +
  "- If the page has multiple sections, keep the full body content, not a summary.\n" +
  "- Use clean Markdown (headings, lists, fenced code blocks). No HTML.\n" +
  "- Never use em dashes (—) or en dashes (–). Use commas, periods, semicolons, or colons.\n" +
  "- Attribute the original creator by name in the `author` field. If no creator is named on the page, use the publication or site name.\n" +
  "- `title` should be a clear, specific title for the skill (max 12 words). Prefer the original page title if usable.\n" +
  "- `description` is a fresh one-sentence summary (STRICT max 100 characters). Do NOT copy from the source verbatim.\n" +
  "- `category` MUST be one of: " + CATEGORIES.join(", ") + ".\n" +
  "- `difficulty` MUST be one of: " + DIFFICULTIES.join(", ") + ".\n" +
  "- `content` is the full skill body in Markdown, minimum 200 words.\n\n" +
  "OUTPUT FORMAT: Return ONLY strict JSON (no markdown, no code fences) matching:\n" +
  `{"title":"...","description":"...","category":"...","difficulty":"...","content":"...","author":"..."}`;

async function callLovableAI<T>(body: unknown): Promise<T> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

async function refineWithClaude(draft: SkillDraft): Promise<SkillDraft | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: SKILLS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content:
              "Refine the following skill draft for clarity, structure, and flow. Do NOT change facts, code, quotes, author name, or the substance of the content. " +
              "Preserve all code blocks verbatim. Improve headings and prose only. " +
              "Return ONLY strict JSON in the same shape.\n\n" +
              `DRAFT JSON:\n${JSON.stringify(draft)}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const text: string = Array.isArray(json?.content)
      ? json.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
      : "";
    if (!text) return null;
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as SkillDraft;
    if (!validateDraft(parsed).ok) return null;
    return parsed;
  } catch {
    return null;
  }
}

function validateDraft(d: SkillDraft): { ok: true } | { ok: false; reason: string } {
  if (!d?.title || d.title.trim().length < 4) return { ok: false, reason: "title missing" };
  if (!d?.description || d.description.trim().length < 10) return { ok: false, reason: "description missing" };
  if (!CATEGORIES.includes(d.category as SkillCategory)) return { ok: false, reason: `invalid category: ${d.category}` };
  if (!DIFFICULTIES.includes(d.difficulty as SkillDifficulty)) return { ok: false, reason: `invalid difficulty: ${d.difficulty}` };
  const words = (d.content || "").split(/\s+/).filter(Boolean).length;
  if (words < 200) return { ok: false, reason: `content too short (${words} words)` };
  if (!d.author || d.author.trim().length < 2) return { ok: false, reason: "author missing" };
  return { ok: true };
}

export async function runSkillsAgentCore(args: RunSkillsArgs) {
  const { supabase } = args;
  const log: string[] = [];
  const logLine = (m: string) => { log.push(`[${new Date().toISOString()}] ${m}`); };

  const { data: runRow, error: runErr } = await supabase
    .from("agent_runs")
    .insert({
      triggered_by: args.triggeredBy,
      trigger: `${args.trigger}-skills`,
      status: "running",
      requested_count: args.count,
      focus: "skills",
    })
    .select("id")
    .single();
  if (runErr) throw new Error(runErr.message);
  const runId = runRow.id as string;

  try {
    // 0. Load auto-publish safety toggle
    const { data: settings } = await supabase
      .from("agent_settings")
      .select("auto_publish_paused")
      .eq("singleton", true)
      .maybeSingle();
    const autoPublishPaused = !!settings?.auto_publish_paused;
    logLine(`Auto-publish paused toggle: ${autoPublishPaused ? "ON (all skills go to manual review)" : "off"}`);

    // 1. Load skill source URLs
    const { data: sources } = await supabase
      .from("agent_sources")
      .select("value,label")
      .eq("enabled", true)
      .eq("kind", "skill_url");
    const urls: Array<{ url: string; label: string }> = (sources ?? [])
      .map((s: any) => ({ url: String(s.value).trim(), label: String(s.label ?? "") }))
      .filter((s: { url: string; label: string }) => /^https?:\/\//i.test(s.url));

    if (urls.length === 0) throw new Error("No enabled skill_url sources. Add one under Trusted sources with kind 'skill_url'.");
    logLine(`Loaded ${urls.length} skill source URL(s)`);

    // 2. Dedupe against seen table
    const hashed = urls.map((s) => ({ ...s, hash: hashUrl(s.url) }));
    const { data: seen } = await supabase
      .from("agent_seen_sources")
      .select("url_hash")
      .in("url_hash", hashed.map((h) => h.hash));
    const seenHashes = new Set((seen ?? []).map((r: any) => r.url_hash));
    const fresh = hashed.filter((h) => !seenHashes.has(h.hash));
    logLine(`${fresh.length} URL(s) fresh after dedupe`);
    if (fresh.length === 0) throw new Error("All configured skill URLs have already been imported. Add new URLs or remove entries from agent_seen_sources.");

    if (!process.env.FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY missing, link Firecrawl in Connectors.");
    const fc = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

    const target = Math.min(args.count, fresh.length);
    let created = 0;
    let autoPublished = 0;
    let manualReview = 0;
    const autoPublishedItems: Array<{ title: string; source: string; slug: string }> = [];

    const TRUSTED_AUTO_HOST = "github.com/anthropics/skills";

    for (const cand of fresh) {
      if (created >= target) break;
      try {
        logLine(`Scraping skill URL: ${cand.url}`);
        const scraped: any = await fc.scrape(cand.url, {
          formats: ["markdown"],
          onlyMainContent: true,
        });
        const md: string = scraped?.markdown || scraped?.data?.markdown || "";
        const meta: any = scraped?.metadata || scraped?.data?.metadata || {};
        const pageTitle: string = meta.title || meta.ogTitle || cand.label || "";
        const siteName: string = meta.siteName || meta.ogSiteName || "";
        const pageAuthor: string = meta.author || meta.byline || "";

        const words = md.split(/\s+/).filter(Boolean).length;
        if (words < 150) { logLine(`Skipped: page has only ${words} words`); continue; }

        const userPrompt =
          `Source URL: ${cand.url}\n` +
          `Page title: ${pageTitle}\n` +
          `Site name: ${siteName}\n` +
          `Detected author (may be empty): ${pageAuthor}\n\n` +
          `SCRAPED CONTENT:\n${md.slice(0, 16000)}`;

        // Stage 1: Gemini extraction
        const aiRes: any = await callLovableAI({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SKILLS_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        });
        const content: string = aiRes?.choices?.[0]?.message?.content ?? "";
        let draft: SkillDraft;
        try { draft = JSON.parse(content); }
        catch { logLine("Skipped: non-JSON response from Gemini"); continue; }

        const v = validateDraft(draft);
        if (!v.ok) { logLine(`Skipped: validation failed (${v.reason})`); continue; }
        logLine(`Gemini draft accepted: ${draft.title}`);

        // Stage 2: Claude refinement
        const refined = await refineWithClaude(draft);
        if (refined) { draft = refined; logLine("Claude editor pass applied"); }
        else logLine("Claude pass skipped/failed, using Gemini draft");

        // Strip em/en dashes across all string fields
        draft = {
          ...draft,
          title: stripEmDashes(draft.title),
          description: stripEmDashes(draft.description),
          content: stripEmDashes(draft.content),
          author: stripEmDashes(draft.author),
        };

        // Enforce category validity for Claude Code file requirement:
        // if extractor picked "Claude Code" but we have no file, downgrade to "Other"
        // to avoid violating the CHECK constraint.
        if (draft.category === "Claude Code") {
          logLine("Downgrading category from 'Claude Code' to 'Other' (no downloadable file attached; add manually to promote)");
          draft.category = "Other";
        }

        // Attribution is REQUIRED. Never present a fetched skill as Cognarah's own work.
        const rawAttribution = (draft.author?.trim() || pageAuthor?.trim() || siteName?.trim() || "");
        if (!rawAttribution) {
          logLine(`FLAGGED for manual review: no attributable author or source name for ${cand.url}. Skill NOT saved.`);
          continue;
        }
        const attribution = rawAttribution;
        const slug = slugify(draft.title, { lower: true, strict: true }).slice(0, 110) + "-" + Date.now().toString(36);

        // ===== TIER 1 auto-publish evaluation =====
        const tier1Reasons: string[] = [];
        const normalizedUrl = cand.url.toLowerCase();
        const isTrustedHost = normalizedUrl.includes(TRUSTED_AUTO_HOST);
        if (!isTrustedHost) tier1Reasons.push(`source not from ${TRUSTED_AUTO_HOST}`);
        if (!attribution || attribution.length < 2) tier1Reasons.push("author empty");
        if (!draft.content || draft.content.length < 200) tier1Reasons.push(`content shorter than 200 chars (${draft.content?.length ?? 0})`);

        // De-dupe by source_attribution URL in skills table
        const { data: existingSkill } = await supabase
          .from("skills")
          .select("id")
          .eq("source_attribution", cand.url)
          .maybeSingle();
        if (existingSkill) tier1Reasons.push("duplicate source_attribution already in skills table");

        // File URL validation (only meaningful when a file is present).
        // For Tier 1, a valid file_url is REQUIRED and must return successfully.
        // The extraction pipeline currently doesn't attach files, so this fails for now
        // unless a future extension pulls the file. This preserves the rule while keeping
        // the pipeline safe.
        let fileUrl: string | null = null;
        if (!fileUrl) {
          tier1Reasons.push("no file_url attached (Tier 1 requires a valid downloadable file)");
        } else {
          try {
            const head = await fetch(fileUrl, { method: "HEAD" });
            if (!head.ok) tier1Reasons.push(`file_url HEAD returned ${head.status}`);
          } catch (e: any) {
            tier1Reasons.push(`file_url fetch failed: ${e?.message || e}`);
          }
        }

        const meetsTier1 = tier1Reasons.length === 0;
        const publishNow = meetsTier1 && !autoPublishPaused;

        const { data: insertedSkill, error: insErr } = await supabase
          .from("skills")
          .insert({
            title: draft.title.slice(0, 200),
            slug,
            description: draft.description.slice(0, 100),
            category: draft.category,
            difficulty: draft.difficulty,
            content: draft.content,
            file_url: fileUrl,
            author: attribution.slice(0, 120),
            published: publishNow,
            source_url: cand.url,
            source_attribution: cand.url,
          })
          .select("id")
          .single();
        if (insErr) { logLine(`Insert failed: ${insErr.message}`); continue; }

        await supabase.from("agent_seen_sources").insert({
          url_hash: hashUrl(cand.url),
          url: cand.url,
          article_id: null,
          run_id: runId,
        });
        created++;
        if (publishNow) {
          autoPublished++;
          autoPublishedItems.push({ title: draft.title, source: cand.url, slug });
          logLine(`AUTO-PUBLISHED: ${draft.title} (${insertedSkill.id})`);
        } else {
          manualReview++;
          if (meetsTier1 && autoPublishPaused) {
            logLine(`MANUAL REVIEW (auto-publish paused): ${draft.title} (${insertedSkill.id})`);
          } else {
            logLine(`MANUAL REVIEW: ${draft.title} (${insertedSkill.id}) — Tier 1 failed: ${tier1Reasons.join("; ")}`);
          }
        }
      } catch (e: any) {
        logLine(`Candidate error: ${e?.message || e}`);
      }
    }

    logLine(`Run summary: ${autoPublished} auto-published, ${manualReview} sent to manual review`);

    // Send notification for auto-published skills
    if (autoPublished > 0) {
      try {
        const { enqueueTransactionalEmail } = await import("./email/enqueue-internal.server");
        const notif = await enqueueTransactionalEmail({
          templateName: "skills-auto-published",
          templateData: {
            skills: autoPublishedItems,
            runId,
            reviewUrl: "https://cognarah.com/admin/skills",
          },
          idempotencyKey: `skills-auto-published:${runId}`,
        });
        if ("ok" in notif && notif.ok) logLine("Notification queued for auto-published skills");
        else logLine(`Notification skipped: ${(notif as any).reason ?? "unknown"}`);
      } catch (e: any) {
        logLine(`Notification error: ${e?.message || e}`);
      }
    }

    await supabase
      .from("agent_runs")
      .update({
        status: created > 0 ? "success" : "error",
        drafts_created: created,
        auto_published_count: autoPublished,
        manual_review_count: manualReview,
        log: log.join("\n"),
        finished_at: new Date().toISOString(),
        error: created === 0 ? "No skill drafts created, see log" : null,
      })
      .eq("id", runId);

    return { run_id: runId, drafts_created: created, auto_published: autoPublished, manual_review: manualReview, log };
  } catch (e: any) {
    await supabase
      .from("agent_runs")
      .update({
        status: "error",
        error: String(e?.message || e),
        log: log.join("\n"),
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    throw e;
  }
}
