// Server-only: full agent orchestration. Loaded via dynamic import from agent.functions.ts.
import Firecrawl from "@mendable/firecrawl-js";
import slugify from "slugify";
import { createHash } from "crypto";

type Sb = any;

interface RunAgentArgs {
  supabase: Sb;
  triggeredBy: string | null;
  trigger: "manual" | "scheduled";
  count: number;
  focus: string | null;
  categoryId: string | null;
}

interface DraftPayload {
  title: string;
  dek: string;
  body_html: string;
  tags: string[];
  seo_title: string;
  meta_description: string;
  category_slug: string;
}

const CATEGORY_HINTS = [
  "latest", "africa-ai", "policy-ethics", "startups", "funding-rounds",
  "trends", "analysis", "opinions", "tools", "interviews", "events",
];

function hashUrl(url: string) {
  return createHash("sha256").update(url.trim().toLowerCase()).digest("hex");
}

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

async function generateAiImage(prompt: string): Promise<Buffer | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        prompt: `Editorial magazine hero illustration for an AI news article. ${prompt}. Dark navy #0A0F2C background with lavender purple #AFA9EC and coral #EF9F27 accents. Bold, minimal, no text, no logos, cinematic lighting.`,
      }),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) return null;
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

async function downloadImage(url: string): Promise<{ buf: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "CognarahBot/1.0" } });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024 || buf.length > 8 * 1024 * 1024) return null;
    return { buf, contentType: ct };
  } catch {
    return null;
  }
}

async function uploadToMedia(buf: Buffer, contentType: string, slug: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = `hero/agent/${Date.now()}-${slug}.${ext}`;
  const { error } = await supabaseAdmin.storage.from("media").upload(path, buf, {
    contentType,
    upsert: false,
  });
  if (error) {
    console.error("[agent] upload failed", error);
    return null;
  }
  return `/api/public/media/${path}`;
}

export async function runAgentCore(args: RunAgentArgs) {
  const { supabase } = args;
  const log: string[] = [];
  const logLine = (m: string) => { log.push(`[${new Date().toISOString()}] ${m}`); };

  // 1. Create run row
  const { data: runRow, error: runErr } = await supabase
    .from("agent_runs")
    .insert({
      triggered_by: args.triggeredBy,
      trigger: args.trigger,
      status: "running",
      requested_count: args.count,
      focus: args.focus,
    })
    .select("id")
    .single();
  if (runErr) throw new Error(runErr.message);
  const runId = runRow.id as string;

  try {
    // 2. Load sources
    const { data: sources } = await supabase
      .from("agent_sources")
      .select("kind,value")
      .eq("enabled", true);
    const domains: string[] = (sources ?? [])
      .filter((s: any) => s.kind === "domain")
      .map((s: any) => s.value);

    // 3. Build search queries
    const focusPart = args.focus?.trim() || "artificial intelligence";
    const baseQueries = [
      `${focusPart} news`,
      `${focusPart} startup funding`,
      `Africa AI ${focusPart}`,
    ];
    const domainFilter = domains.length
      ? " (" + domains.slice(0, 8).map((d) => `site:${d}`).join(" OR ") + ")"
      : "";

    // 4. Search via Firecrawl
    if (!process.env.FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY missing — link Firecrawl in Connectors.");
    const fc = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

    const seenUrls = new Set<string>();
    const candidates: Array<{ url: string; title?: string; description?: string }> = [];

    for (const q of baseQueries) {
      try {
        logLine(`Searching: ${q}${domainFilter}`);
        const searchRes: any = await fc.search(q + domainFilter, { limit: 8 });
        const results: any[] = searchRes?.web ?? searchRes?.data ?? [];
        for (const r of results) {
          const url = r.url as string | undefined;
          if (!url || seenUrls.has(url)) continue;
          seenUrls.add(url);
          candidates.push({ url, title: r.title, description: r.description });
        }
      } catch (e: any) {
        logLine(`Search error: ${e?.message || e}`);
      }
      if (candidates.length >= 20) break;
    }
    logLine(`Found ${candidates.length} candidates`);

    // 5. De-dupe against seen table
    const hashes = candidates.map((c) => ({ ...c, hash: hashUrl(c.url) }));
    if (hashes.length === 0) throw new Error("No candidate articles found");
    const { data: seen } = await supabase
      .from("agent_seen_sources")
      .select("url_hash")
      .in("url_hash", hashes.map((h) => h.hash));
    const seenHashes = new Set((seen ?? []).map((s: any) => s.url_hash));
    const fresh = hashes.filter((h) => !seenHashes.has(h.hash));
    logLine(`${fresh.length} fresh after dedupe`);

    // 6. Load categories & Cognarah AI author
    const [{ data: cats }, { data: authorRow }] = await Promise.all([
      supabase.from("categories").select("id,slug,name"),
      supabase.from("authors").select("id").eq("slug", "cognarah-ai").maybeSingle(),
    ]);
    const catBySlug = new Map<string, any>((cats ?? []).map((c: any) => [c.slug, c]));
    const aiAuthorId: string | null = authorRow?.id ?? null;
    const overrideCategory = args.categoryId
      ? (cats ?? []).find((c: any) => c.id === args.categoryId)
      : null;

    // 7. For up to N, scrape + write + insert
    const target = Math.min(args.count, fresh.length);
    let created = 0;
    for (const cand of fresh) {
      if (created >= target) break;
      try {
        logLine(`Scraping: ${cand.url}`);
        const scraped: any = await fc.scrape(cand.url, {
          formats: ["markdown"],
          onlyMainContent: true,
        });
        const md: string = scraped?.markdown || scraped?.data?.markdown || "";
        const meta: any = scraped?.metadata || scraped?.data?.metadata || {};
        const ogImg: string | undefined =
          meta.ogImage || meta["og:image"] || meta.twitterImage || meta["twitter:image"];
        if (!md || md.length < 400) { logLine("Skipped: too short"); continue; }

        // 8. Ask Lovable AI to rewrite
        const sysPrompt =
          "You are Cognarah, an editorial AI news desk covering artificial intelligence with a special focus on Africa. " +
          "Rewrite the given source article into an original Cognarah news piece. Do not plagiarize; use your own words. " +
          "Write in a confident, modern editorial voice similar to TechCrunch. " +
          "Return ONLY strict JSON matching this shape: " +
          `{"title":"...","dek":"1-2 sentence subtitle","body_html":"<p>...</p><h2>...</h2>...","tags":["..."],"seo_title":"...","meta_description":"...","category_slug":"one of: ${CATEGORY_HINTS.join(", ")}"}` +
          " body_html must be 500-900 words, valid HTML using only p, h2, h3, ul, ol, li, strong, em, blockquote, a. " +
          "Add a final <p><em>Source:</em> <a href=\"SOURCE_URL\">Publication name</a></p> paragraph citing the source. No markdown, no code fences.";
        const userPrompt = `Focus: ${focusPart}\nSource URL: ${cand.url}\nSource title: ${cand.title ?? ""}\n\nSource content:\n${md.slice(0, 12000)}`;
        const aiRes: any = await callLovableAI({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        });
        const content: string = aiRes?.choices?.[0]?.message?.content ?? "";
        let draft: DraftPayload;
        try {
          draft = JSON.parse(content);
        } catch {
          logLine("Skipped: LLM returned non-JSON");
          continue;
        }
        if (!draft.title || !draft.body_html) { logLine("Skipped: incomplete draft"); continue; }

        const slug = slugify(draft.title, { lower: true, strict: true }).slice(0, 110) + "-" + Date.now().toString(36);

        // 9. Hero image
        let heroPath: string | null = null;
        if (ogImg) {
          logLine(`Trying source image: ${ogImg}`);
          const dl = await downloadImage(ogImg);
          if (dl) heroPath = await uploadToMedia(dl.buf, dl.contentType, slug);
        }
        if (!heroPath) {
          logLine("Falling back to AI-generated image");
          const aiImg = await generateAiImage(`${draft.title}. ${draft.dek}`);
          if (aiImg) heroPath = await uploadToMedia(aiImg, "image/png", slug);
        }

        // 10. Resolve category
        const category = overrideCategory
          || catBySlug.get(draft.category_slug)
          || catBySlug.get("latest")
          || (cats ?? [])[0];

        // 11. Insert draft article
        const { data: insertedArticle, error: insErr } = await supabase
          .from("articles")
          .insert({
            title: draft.title.slice(0, 200),
            slug,
            excerpt: draft.dek?.slice(0, 300) ?? null,
            body: draft.body_html,
            hero_image: heroPath,
            author_id: aiAuthorId,
            author_user_id: args.triggeredBy,
            category_id: category?.id ?? null,
            tags: (draft.tags ?? []).slice(0, 8),
            seo_title: draft.seo_title?.slice(0, 200) ?? null,
            meta_description: draft.meta_description?.slice(0, 300) ?? null,
            read_time: Math.max(2, Math.round((draft.body_html.length / 1000) * 0.7)),
            status: "draft",
            is_featured: false,
            agent_run_id: runId,
            source_urls: [cand.url],
          })
          .select("id")
          .single();
        if (insErr) { logLine(`Insert failed: ${insErr.message}`); continue; }

        await supabase.from("agent_seen_sources").insert({
          url_hash: hashUrl(cand.url),
          url: cand.url,
          article_id: insertedArticle.id,
          run_id: runId,
        });
        created++;
        logLine(`Created draft: ${draft.title}`);
      } catch (e: any) {
        logLine(`Candidate error: ${e?.message || e}`);
      }
    }

    await supabase
      .from("agent_runs")
      .update({
        status: created > 0 ? "success" : "error",
        drafts_created: created,
        log: log.join("\n"),
        finished_at: new Date().toISOString(),
        error: created === 0 ? "No drafts created — see log" : null,
      })
      .eq("id", runId);

    return { run_id: runId, drafts_created: created, log };
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
