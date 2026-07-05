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

// URL path segments that indicate a listing / index page, not an article.
const LISTING_SEGMENTS = new Set([
  "tag", "tags", "category", "categories", "topic", "topics", "topics",
  "section", "sections", "author", "authors", "feed", "feeds", "rss",
  "search", "archive", "archives", "page", "pages", "index",
]);

// og:image URL patterns that indicate a generic/default share image, not an article-specific hero.
const GENERIC_IMAGE_HINTS = [
  "logo", "default", "placeholder", "share", "social-card", "social_card",
  "fallback", "og-image", "og_image", "og-default", "site-image",
  "twitter-card", "twitter_card", "brand",
];

function hashUrl(url: string) {
  return createHash("sha256").update(url.trim().toLowerCase()).digest("hex");
}

function looksLikeArticleUrl(rawUrl: string): { ok: boolean; reason?: string } {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return { ok: false, reason: "invalid URL" }; }
  const segments = u.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return { ok: false, reason: "root path" };

  // Reject if any segment is a known listing keyword AND it's the last segment
  // (or followed only by a taxonomy value like "artificial-intelligence").
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i].toLowerCase();
    if (LISTING_SEGMENTS.has(seg)) {
      // If the listing keyword is followed only by 0-1 more slug segments AND
      // the URL doesn't also contain a date fragment, it's a taxonomy page.
      const tail = segments.slice(i + 1);
      const hasDate = segments.some((s) => /^(19|20)\d{2}$/.test(s));
      if (tail.length <= 1 && !hasDate) {
        return { ok: false, reason: `listing segment: /${seg}/` };
      }
    }
  }

  // Prefer either a date fragment in URL or a slug-like final segment (>= 4 words).
  const last = segments[segments.length - 1].toLowerCase().replace(/\.(html?|php|aspx?)$/, "");
  const wordCount = last.split(/[-_]/).filter((w) => w.length > 1).length;
  const hasDate = segments.some((s) => /^(19|20)\d{2}$/.test(s));
  if (!hasDate && wordCount < 4) {
    return { ok: false, reason: `slug too short (${wordCount} words) and no date` };
  }
  return { ok: true };
}

function isGenericOgImage(imgUrl: string, articleSlug: string): { ok: boolean; reason?: string } {
  const lower = imgUrl.toLowerCase();
  for (const hint of GENERIC_IMAGE_HINTS) {
    if (lower.includes(hint)) return { ok: false, reason: `image URL contains "${hint}"` };
  }
  // Very short filename (< 6 chars before extension) often signals a default asset.
  try {
    const u = new URL(imgUrl);
    const file = u.pathname.split("/").pop() ?? "";
    const stem = file.replace(/\.[a-z0-9]+$/i, "");
    if (stem.length > 0 && stem.length < 6) return { ok: false, reason: `image filename too short: ${file}` };
  } catch { /* ignore */ }
  void articleSlug; // reserved for future slug-similarity checks
  return { ok: true };
}

// Rough PNG/JPEG dimension sniff without pulling in a native dep.
function sniffImageDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  // PNG: signature 89 50 4E 47 0D 0A 1A 0A, IHDR at offset 16.
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: scan SOF markers.
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        const height = buf.readUInt16BE(i + 5);
        const width = buf.readUInt16BE(i + 7);
        return { width, height };
      }
      i += 2 + len;
    }
  }
  // WebP: RIFF....WEBP VP8[ L X] chunk.
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") {
    const chunk = buf.slice(12, 16).toString("ascii");
    if (chunk === "VP8 " && buf.length >= 30) {
      const width = buf.readUInt16LE(26) & 0x3fff;
      const height = buf.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }
    if (chunk === "VP8L" && buf.length >= 25) {
      const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height };
    }
    if (chunk === "VP8X" && buf.length >= 30) {
      const width = 1 + buf.readUIntLE(24, 3);
      const height = 1 + buf.readUIntLE(27, 3);
      return { width, height };
    }
  }
  return null;
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

// Stage 2 editor: Claude refines the Gemini draft for tone/structure/quality.
// MUST NOT change facts, quotes, or links. Returns null on any failure so the
// caller can fall back to the Gemini draft.
async function refineWithClaude(draft: DraftPayload, sourceUrl: string): Promise<DraftPayload | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const editorInstruction =
    "You are the senior editor. Refine the following draft for tone, structure, flow, and editorial quality per the SYSTEM_PROMPT above. " +
    "STRICT CONSTRAINTS: do NOT change any facts, figures, names, dates, quotes, or <a href=\"...\"> links. " +
    "Preserve the Source URL and 'Source:' footer link exactly. Keep the same JSON schema. " +
    "Improve writing only — sharpen headline/dek within their word limits, tighten prose, fix awkward phrasing, ensure required sections exist. " +
    "Return ONLY strict JSON matching the original shape — no markdown, no code fences, no commentary.\n\n" +
    `Source URL (must be preserved in the Source footer link): ${sourceUrl}\n\n` +
    `DRAFT JSON:\n${JSON.stringify(draft)}`;
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
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: editorInstruction }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Claude ${res.status}: ${t.slice(0, 300)}`);
    }
    const json: any = await res.json();
    const text: string = Array.isArray(json?.content)
      ? json.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
      : "";
    if (!text) return null;
    // Strip accidental code fences.
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as DraftPayload;
    const v = validateDraft(parsed);
    if (!v.ok) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Vision check: does this image plausibly illustrate the article?
async function isImageRelevant(imageBuf: Buffer, contentType: string, title: string, dek: string): Promise<{ ok: boolean; reason: string }> {
  try {
    const b64 = imageBuf.toString("base64");
    const dataUrl = `data:${contentType};base64,${b64}`;
    const res: any = await callLovableAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a photo editor for a news publication. Decide if the given image is a plausible editorial hero for the given article. " +
            "Reject generic stock photos, unrelated product shots, brand logos with no article context, and default social share cards. " +
            'Respond with STRICT JSON only: {"relevant": true|false, "reason": "short reason"}',
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Article title: ${title}\nSubtitle: ${dek}\n\nIs this image a plausible editorial hero?` },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });
    const content: string = res?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    return { ok: !!parsed.relevant, reason: String(parsed.reason ?? "") };
  } catch (e: any) {
    // If the vision check fails, err on the side of using the image (source
    // images pass URL/dimension gates already).
    return { ok: true, reason: `vision check failed: ${e?.message || e}` };
  }
}

async function generateAiImage(title: string, dek: string): Promise<Buffer | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const subject = `${title}. ${dek}`.slice(0, 400);
  const prompt =
    `Editorial magazine hero illustration for a news article. Subject: ${subject}. ` +
    `Style: cinematic, symbolic, minimal, sophisticated. Dark navy #0A0F2C background with lavender purple #AFA9EC and coral #EF9F27 accents. ` +
    `No text, no words, no logos, no watermarks. Wide 16:9 composition, high detail.`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        prompt,
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

export async function downloadImage(url: string): Promise<{ buf: Buffer; contentType: string } | null> {
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

export async function uploadToMedia(buf: Buffer, contentType: string, slug: string): Promise<string | null> {
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

// Re-exports for use by regenerate/validate hero server functions.
export { generateAiImage, isImageRelevant, sniffImageDimensions, isGenericOgImage };


function wordCount(html: string): number {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

function validateDraft(d: DraftPayload): { ok: true } | { ok: false; reason: string } {
  if (!d.title || d.title.trim().split(/\s+/).length < 6) return { ok: false, reason: "title too short (< 6 words)" };
  if (!d.dek || d.dek.trim().split(/\s+/).length < 15) return { ok: false, reason: "dek too short (< 15 words)" };
  const wc = wordCount(d.body_html || "");
  if (wc < 500) return { ok: false, reason: `body too short (${wc} words)` };
  return { ok: true };
}

const SYSTEM_PROMPT =
  "You are Cognarah, an editorial AI news desk covering artificial intelligence with a special focus on Africa. " +
  "Rewrite the source article into an original Cognarah news piece in your own words — no plagiarism, no verbatim paragraphs. " +
  "Editorial voice: confident, specific, modern (TechCrunch / Axios / The Information). Never generic. Never corporate filler. " +
  "\n\nHEADLINE RULES:\n" +
  "- Name the actor AND the action. Example: 'Anthropic Pushes Back on White House AI Export Rules' — NOT 'Silicon Valley's Fragile Peace'.\n" +
  "- No vague metaphors, no 'The Future Of', no 'A New Era'.\n" +
  "- 6-14 words.\n" +
  "\nDEK (subtitle) RULES:\n" +
  "- 20-35 words, one or two sentences.\n" +
  "- Must contain at least one concrete fact from the source: a company name, a person, a dollar figure, a date, a country, a model name, or a percentage.\n" +
  "\nBODY RULES:\n" +
  "- 550-850 words of clean HTML using only: p, h2, h3, ul, ol, li, strong, em, blockquote, a.\n" +
  "- Structure: opening paragraph with the news; an <h2>Why it matters</h2> section 2-3 paragraphs in; the details; an <h2>The bigger picture</h2> section near the end.\n" +
  "- Include at least two inline <a href=\"...\"> links to named companies, papers, or original sources.\n" +
  "- End with: <p><em>Source:</em> <a href=\"SOURCE_URL\">Publication name</a></p>\n" +
  "- BANNED phrases: 'in today's fast-paced world', 'revolutionary', 'game-changing', 'game changer', 'unleash', 'harness the power', 'paradigm shift', 'seamlessly', 'cutting-edge'.\n" +
  "\nOUTPUT FORMAT: Return ONLY strict JSON matching this shape (no markdown, no code fences):\n" +
  `{"title":"...","dek":"...","body_html":"<p>...</p><h2>Why it matters</h2>...","tags":["...","..."],"seo_title":"...","meta_description":"...","category_slug":"one of: ${CATEGORY_HINTS.join(", ")}"}`;

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
    // 2. Load sources + settings (time window + query presets)
    const [{ data: sources }, { data: settingsRow }] = await Promise.all([
      supabase.from("agent_sources").select("kind,value").eq("enabled", true),
      supabase.from("agent_settings").select("search_time_window,query_presets").eq("singleton", true).maybeSingle(),
    ]);
    const domains: string[] = (sources ?? [])
      .filter((s: any) => s.kind === "domain")
      .map((s: any) => s.value);
    const validWindows = new Set(["qdr:h", "qdr:d", "qdr:w", "qdr:m", "qdr:y"]);
    const tbs: string = validWindows.has(settingsRow?.search_time_window) ? settingsRow.search_time_window : "qdr:w";
    const presets: string[] = Array.isArray(settingsRow?.query_presets)
      ? settingsRow.query_presets.filter((q: unknown): q is string => typeof q === "string" && q.trim().length > 0)
      : [];
    logLine(`Using time window ${tbs}; ${presets.length} custom query preset(s)`);

    // 3. Build search queries
    const focusPart = args.focus?.trim() || "artificial intelligence";
    const substituted = presets.map((q) => q.replace(/\{focus\}/gi, focusPart));
    const genericQueries = substituted.length
      ? substituted
      : [
          `latest ${focusPart} news`,
          `${focusPart} announcement this week`,
          `${focusPart} startup funding round`,
          `African AI ${focusPart}`,
        ];

    // 4. Search via Firecrawl — one query per domain when configured, plus generic recent queries.
    if (!process.env.FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY missing — link Firecrawl in Connectors.");
    const fc = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

    const seenUrls = new Set<string>();
    const candidates: Array<{ url: string; title?: string; description?: string }> = [];

    async function runSearch(q: string) {
      try {
        logLine(`Searching (${tbs}): ${q}`);
        const searchRes: any = await fc.search(q, { limit: 10, tbs });
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
    }

    // Trusted domains first, then generic/preset queries.
    for (const d of domains.slice(0, 6)) {
      await runSearch(`${focusPart} site:${d}`);
      if (candidates.length >= 30) break;
    }
    for (const q of genericQueries) {
      if (candidates.length >= 30) break;
      await runSearch(q);
    }
    logLine(`Found ${candidates.length} raw candidates`);


    // 4b. URL-shape filter (drop tag/category/section pages).
    const shaped = candidates.filter((c) => {
      const v = looksLikeArticleUrl(c.url);
      if (!v.ok) logLine(`Skipped non-article URL: ${c.url} (${v.reason})`);
      return v.ok;
    });
    logLine(`${shaped.length} after URL-shape filter`);

    // 5. De-dupe against seen table
    const hashes = shaped.map((c) => ({ ...c, hash: hashUrl(c.url) }));
    if (hashes.length === 0) throw new Error("No article-shaped candidates found");
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

        // Article-shape check on the scraped page itself.
        const bodyWords = md.split(/\s+/).filter(Boolean).length;
        if (bodyWords < 600) { logLine(`Skipped: page has only ${bodyWords} words (not article)`); continue; }
        const published: string | undefined =
          meta.publishedTime || meta["article:published_time"] || meta.publishedDate;
        const hasUrlDate = /\/(19|20)\d{2}\//.test(cand.url);
        if (!published && !hasUrlDate) {
          logLine(`Skipped: no publication date on page or in URL`);
          continue;
        }

        // 8. Ask Lovable AI to rewrite — with one retry on validation failure.
        const buildUserPrompt = (nudge?: string) =>
          `Focus: ${focusPart}\nSource URL: ${cand.url}\nSource title: ${cand.title ?? meta.title ?? ""}\n\nSource content:\n${md.slice(0, 12000)}` +
          (nudge ? `\n\nEDITOR NOTE: ${nudge}` : "");

        let draft: DraftPayload | null = null;
        let attempts = 0;
        for (const nudge of [undefined, "Your previous draft was too generic. Rewrite with a specific, actor+action headline; a dek containing at least one concrete fact (name, number, date); and the required Why it matters / bigger picture sections. Avoid all banned phrases."]) {
          attempts++;
          const aiRes: any = await callLovableAI({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: buildUserPrompt(nudge) },
            ],
            response_format: { type: "json_object" },
          });
          const content: string = aiRes?.choices?.[0]?.message?.content ?? "";
          let parsed: DraftPayload;
          try { parsed = JSON.parse(content); } catch { logLine(`Attempt ${attempts}: non-JSON response`); continue; }
          const v = validateDraft(parsed);
          if (v.ok) { draft = parsed; break; }
          logLine(`Attempt ${attempts} failed validation: ${v.reason}`);
        }
        if (!draft) { logLine("Skipped: could not produce valid draft after 2 attempts"); continue; }

        const slug = slugify(draft.title, { lower: true, strict: true }).slice(0, 110) + "-" + Date.now().toString(36);

        // 9. Hero image — prefer source, but validate strictly.
        let heroPath: string | null = null;
        let heroDecision = "";
        if (ogImg) {
          const urlGate = isGenericOgImage(ogImg, slug);
          if (!urlGate.ok) {
            heroDecision = `source rejected (URL gate): ${urlGate.reason}`;
          } else {
            logLine(`Trying source image: ${ogImg}`);
            const dl = await downloadImage(ogImg);
            if (!dl) {
              heroDecision = "source rejected: download failed or wrong size";
            } else {
              const dims = sniffImageDimensions(dl.buf);
              if (dims && (dims.width < 600 || dims.height < 400)) {
                heroDecision = `source rejected: dimensions ${dims.width}x${dims.height} too small`;
              } else {
                const rel = await isImageRelevant(dl.buf, dl.contentType, draft.title, draft.dek);
                if (!rel.ok) {
                  heroDecision = `source rejected (vision): ${rel.reason}`;
                } else {
                  heroPath = await uploadToMedia(dl.buf, dl.contentType, slug);
                  heroDecision = heroPath ? `source image used (vision: ${rel.reason})` : "source upload failed";
                }
              }
            }
          }
        } else {
          heroDecision = "no source og:image";
        }
        logLine(`Hero: ${heroDecision}`);
        if (!heroPath) {
          logLine("Falling back to AI-generated hero");
          const aiImg = await generateAiImage(draft.title, draft.dek);
          if (aiImg) heroPath = await uploadToMedia(aiImg, "image/png", slug);
          logLine(heroPath ? "AI hero generated" : "AI hero generation failed");
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
        logLine(`Created draft (attempts=${attempts}): ${draft.title}`);
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
