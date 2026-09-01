// Server-only: full agent orchestration. Loaded via dynamic import from agent.functions.ts.
import Firecrawl from "@mendable/firecrawl-js";
import slugify from "slugify";
import { createHash } from "crypto";
import { stripEmDashes } from "./strip-em-dashes";

type Sb = any;

interface RunAgentArgs {
  supabase: Sb;
  triggeredBy: string | null;
  trigger: "manual" | "scheduled";
  count: number;
  focus: string | null;
  categoryId: string | null;
  /** When set, reuse this pre-created agent_runs row instead of inserting a new one. */
  existingRunId?: string | null;
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
  "tag", "tags", "category", "categories", "topic", "topics",
  "section", "sections", "author", "authors", "feed", "feeds", "rss",
  "search", "archive", "archives", "page", "pages", "index",
  "video", "videos", "watch", "gallery", "galleries", "photos", "podcast", "podcasts",
  "newsletter", "newsletters", "subscribe", "about", "contact", "login", "signin",
]);

// Hosts that serve video/media, not text articles.
const VIDEO_HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
  "vimeo.com", "www.vimeo.com", "tiktok.com", "www.tiktok.com",
  "twitch.tv", "www.twitch.tv", "dailymotion.com", "www.dailymotion.com",
  "facebook.com", "www.facebook.com", "fb.watch",
  "instagram.com", "www.instagram.com",
]);

// File extensions that are clearly not articles.
const NON_ARTICLE_EXT = /\.(mp4|mov|avi|mkv|webm|mp3|wav|m4a|pdf|zip|rar|jpg|jpeg|png|gif|webp|svg)$/i;

// og:image URL patterns that indicate a generic/default share image, not an article-specific hero.
const GENERIC_IMAGE_HINTS = [
  "logo", "default", "placeholder", "share", "social-card", "social_card",
  "fallback", "og-image", "og_image", "og-default", "site-image",
  "twitter-card", "twitter_card", "brand",
];

function hashUrl(url: string) {
  return createHash("sha256").update(url.trim().toLowerCase()).digest("hex");
}

// Matches a written-out or ISO date near the top of a page's own markdown
// (bylines like "Published August 31, 2026" or "31 August 2026" that many
// sites render in-page without a matching meta tag). Used as a fallback date
// signal alongside metadata and URL-date checks below.
const MONTH_NAMES = "January|February|March|April|May|June|July|August|September|October|November|December";
const TEXT_DATE_REGEX = new RegExp(
  `\\b(?:${MONTH_NAMES})\\s+\\d{1,2},?\\s+(?:19|20)\\d{2}\\b` +
  `|\\b\\d{1,2}\\s+(?:${MONTH_NAMES})\\s+(?:19|20)\\d{2}\\b` +
  // (?!\d) instead of a trailing \b: a full ISO timestamp like
  // "2026-08-31T12:00:00Z" has no word boundary between "31" and "T"
  // (both \w chars), which a trailing \b would miss.
  `|\\b(?:19|20)\\d{2}-\\d{2}-\\d{2}(?!\\d)`,
);


function looksLikeArticleUrl(rawUrl: string): { ok: boolean; reason?: string } {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return { ok: false, reason: "invalid URL" }; }
  const host = u.hostname.toLowerCase();
  if (VIDEO_HOSTS.has(host)) return { ok: false, reason: `video host: ${host}` };
  if (NON_ARTICLE_EXT.test(u.pathname)) return { ok: false, reason: `non-article extension` };

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

// Direct Google Generative Language API model ids. Overridable via env so we
// can swap without a redeploy.
//
// GEMINI_TEXT_MODEL was originally the "-latest" alias so free-tier keys kept
// working when Google retired a specific dated snapshot (a 404 on
// gemini-2.5-flash was the incident that led to that choice). But "-latest"
// is a moving target: as of 2026-09-01 it resolves to a model returning
// persistent 503 "high demand" errors (confirmed directly against the API,
// same failure that killed every candidate in a live agent run — 0/2 drafts
// created despite the pipeline itself completing cleanly). Pinned to
// gemini-3.6-flash instead, same fix already applied to src/lib/gemini.server.ts
// during the Lovable migration for the identical overload issue on
// gemini-3.7-flash. Revisit if this pinned version is ever deprecated.
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

// Sentinel error message the worker pool checks so a model 404 aborts the
// entire run instead of burning every candidate on the same guaranteed failure.
const GEMINI_MODEL_UNAVAILABLE = "GEMINI_MODEL_UNAVAILABLE";

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(opts: {
  model?: string;
  system?: string;
  userParts: GeminiPart[];
  json?: boolean;
  responseModalities?: string[];
  /** Unset = API default. Scoring/classification calls should pass a low
   *  value for consistent judgments; the drafting call should pass a
   *  moderate value, lower than the API default, to curb fabrication while
   *  still allowing editorial voice. */
  temperature?: number;
}): Promise<any> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const model = opts.model ?? GEMINI_TEXT_MODEL;
  const body: any = {
    contents: [{ role: "user", parts: opts.userParts }],
    generationConfig: {},
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  if (opts.json) body.generationConfig.responseMimeType = "application/json";
  if (opts.responseModalities) body.generationConfig.responseModalities = opts.responseModalities;
  if (opts.temperature !== undefined) body.generationConfig.temperature = opts.temperature;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const maxAttempts = 3;
  let delay = 1500;
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const t = await res.text();
    lastErr = `Gemini ${res.status}: ${t.slice(0, 300)}`;
    // Fail fast on 404 NOT_FOUND — the model id is wrong/retired; retrying won't help.
    if (res.status === 404) {
      throw new Error(`${GEMINI_MODEL_UNAVAILABLE}: model ${model} not available (${t.slice(0, 200)})`);
    }
    // Retry on rate limit and transient server errors with exponential backoff.
    if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
      // Prefer server-suggested retry delay when present.
      let waitMs = delay;
      const m = t.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
      if (m) waitMs = Math.max(waitMs, Math.ceil(parseFloat(m[1]) * 1000));
      await sleep(waitMs);
      delay = Math.min(delay * 2, 30_000);
      continue;
    }
    // Make quota errors explicit in logs.
    if (res.status === 429) {
      throw new Error(`Gemini Quota Exceeded: ${t.slice(0, 300)}`);
    }
    throw new Error(lastErr);
  }
  throw new Error(lastErr || "Gemini: exhausted retries");
}

function geminiText(json: any): string {
  const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("");
}

function geminiInlineImage(json: any): string | null {
  const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const data = p?.inline_data?.data ?? p?.inlineData?.data;
    if (data) return data as string;
  }
  return null;
}

// Stage 2 editor: Claude refines the Gemini draft for tone/structure/quality.
// MUST NOT change facts, quotes, or links. Returns null on any failure so the
// caller can fall back to the Gemini draft.
async function refineWithClaude(
  draft: DraftPayload,
  sourceUrl: string,
  africa?: AfricaAssessment,
  fixIssues?: string[],
): Promise<DraftPayload | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const editorInstruction = fixIssues && fixIssues.length
    ? "You are the senior editor doing a targeted correction pass, not a full rewrite. The copy chief's QA check flagged these specific issues; fix ONLY them, changing as little else as possible:\n" +
      fixIssues.map((i) => `- ${i}`).join("\n") + "\n\n" +
      "Do NOT change any other facts, figures, names, dates, quotes, or <a href=\"...\"> links. Preserve the Source URL and the 'Reporting sourced from' footer link exactly, unless fixing it is one of the listed issues. Keep the same JSON schema. " +
      "Return ONLY strict JSON matching the original shape, no markdown, no code fences, no commentary.\n\n" +
      `Source URL (must be preserved in the footer link): ${sourceUrl}\n\n` +
      `DRAFT JSON:\n${JSON.stringify(draft)}`
    : "You are the senior editor. Refine the following draft for tone, structure, flow, and editorial quality per the SYSTEM_PROMPT above. " +
      "STRICT CONSTRAINTS: do NOT change any facts, figures, names, dates, quotes, or <a href=\"...\"> links. " +
      "Preserve the Source URL and the 'Reporting sourced from' footer link exactly. Preserve the <h2>The Cognarah Angle</h2> divider. " +
      "Do NOT move source citations or attribution into the Cognarah Angle or the closing line, those sections are Cognarah's own voice. " +
      "Keep the same JSON schema. " +
      "Improve writing only, sharpen headline/dek within their word limits, tighten prose, fix awkward phrasing, ensure required sections exist, and keep the editorial edge (a clear stance and one pointed question or contrarian observation in the Cognarah Angle or closing line). " +
      (africa ? africaEditorConstraint(africa) : "") +
      "Return ONLY strict JSON matching the original shape, no markdown, no code fences, no commentary.\n\n" +
      `Source URL (must be preserved in the footer link): ${sourceUrl}\n\n` +
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

// Hosts whose editorial images we trust enough to skip the Gemini vision check.
const TRUSTED_IMAGE_HOSTS = new Set([
  "techcrunch.com",
  "www.techcrunch.com",
  "wired.com",
  "www.wired.com",
]);

// Vision check: does this image plausibly illustrate the article?
async function isImageRelevant(
  imageBuf: Buffer,
  contentType: string,
  title: string,
  dek: string,
  imageUrl?: string,
): Promise<{ ok: boolean; reason: string }> {
  try {
    if (imageUrl) {
      const host = new URL(imageUrl).hostname.toLowerCase();
      if (TRUSTED_IMAGE_HOSTS.has(host)) {
        return { ok: true, reason: `trusted image host: ${host}` };
      }
    }
    const b64 = imageBuf.toString("base64");
    const json = await callGemini({
      system:
        "You are a photo editor for a news publication. Decide if the given image is a plausible editorial hero for the given article. " +
        "Reject generic stock photos, unrelated product shots, brand logos with no article context, and default social share cards. " +
        'Respond with STRICT JSON only: {"relevant": true|false, "reason": "short reason"}',
      userParts: [
        { text: `Article title: ${title}\nSubtitle: ${dek}\n\nIs this image a plausible editorial hero?` },
        { inline_data: { mime_type: contentType, data: b64 } },
      ],
      json: true,
      temperature: 0.1,
    });
    const content = geminiText(json).replace(/```(?:json)?\s*|\s*```/gi, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { ok: true, reason: "parsing failed" };
    }
    return { ok: !!parsed.relevant, reason: String(parsed.reason ?? "") };
  } catch (e: any) {
    // If the vision check fails, err on the side of using the image (source
    // images pass URL/dimension gates already).
    return { ok: true, reason: `vision check failed: ${e?.message || e}` };
  }
}

async function generateAiImage(
  title: string,
  dek: string,
): Promise<{ buf: Buffer } | { error: string }> {
  if (!process.env.GEMINI_API_KEY) return { error: "GEMINI_API_KEY missing" };
  const subject = `${title}. ${dek}`.slice(0, 400);
  const prompt =
    `Editorial magazine hero illustration for a news article. Subject: ${subject}. ` +
    `Style: cinematic, symbolic, minimal, sophisticated. Dark navy #0A0F2C background with lavender purple #AFA9EC and coral #EF9F27 accents. ` +
    `No text, no words, no logos, no watermarks. Wide 16:9 composition, high detail.`;
  try {
    const json = await callGemini({
      model: GEMINI_IMAGE_MODEL,
      userParts: [{ text: prompt }],
      responseModalities: ["IMAGE", "TEXT"],
    });
    const b64 = geminiInlineImage(json);
    if (!b64) {
      return { error: `no inline image in response` };
    }
    return { buf: Buffer.from(b64, "base64") };
  } catch (e: any) {
    return { error: `image generation failed: ${e?.message || e}` };
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

function validateDraft(d: DraftPayload): { ok: true; words: number } | { ok: false; reason: string; words: number } {
  const wc = wordCount(d.body_html || "");
  if (!d.title || d.title.trim().split(/\s+/).length < 6) return { ok: false, reason: "title too short (< 6 words)", words: wc };
  if (!d.dek || d.dek.trim().split(/\s+/).length < 15) return { ok: false, reason: "dek too short (< 15 words)", words: wc };
  if (wc < 350) return { ok: false, reason: `body too short (${wc} words)`, words: wc };
  return { ok: true, words: wc };
}

// ===========================================================================
// Conditional African relevance. Cognarah is African-first, not Africa-forced:
// a story only gets an African angle when there is specific, evidence-backed
// relevance. Scored 0-5 before drafting; 3+ triggers one targeted research
// search and is downgraded again if that research finds nothing usable.
// ===========================================================================

export interface AfricaAssessment {
  score: number; // 0-5
  reason: string;
  evidence: string[];
  angle_used: boolean;
  angle_type: string | null;
  research_notes?: string;
}

const AFRICA_ANGLE_TYPES = [
  "developers", "startups", "policy", "infrastructure", "funding", "language",
  "enterprise", "workforce", "availability", "pricing", "direct_africa_story",
];

const AFRICA_SIGNALS =
  "product or service availability in African countries; pricing and affordability; API access; payment accessibility; " +
  "cloud availability; compute and GPU infrastructure; data centres; connectivity requirements; African language support; " +
  "local datasets; AI regulation and policy; data protection; African developers, startups and founders; venture funding; " +
  "enterprise adoption; banking and fintech; healthcare; agriculture; education; government services; telecoms; " +
  "employment and workforce impact; BPO and outsourcing; AI skills and talent; research institutions and universities; " +
  "cybersecurity; African competitors; existing African customers or partners; expansion into African markets";

const AFRICA_ASSESS_SYSTEM =
  "You are Cognarah's editorial relevance assessor. Cognarah is African-first, not Africa-forced.\n" +
  "Ask ONLY: 'Does this development have a specific, meaningful and evidence-supported implication for Africa or an African market?'\n" +
  "NEVER ask 'How can this story be connected to Africa?'. Artificial or speculative connections are a failure.\n\n" +
  "Score 0: no identifiable African connection.\n" +
  "Score 1: an African connection can be imagined but there is no meaningful evidence.\n" +
  "Score 2: reasonable indirect implication, not significant enough for dedicated analysis.\n" +
  "Score 3: specific, supportable implication for an identifiable African group.\n" +
  "Score 4: significant implications for African markets, ecosystems, policy, infrastructure, investment, talent or adoption.\n" +
  "Score 5: Africa, an African country, organisation, founder, startup, government or market is a primary subject of the story.\n\n" +
  `Relevance signals to weigh (these are signals, NOT instructions to force a connection): ${AFRICA_SIGNALS}.\n\n` +
  "EVIDENCE RULE: a score of 3 or higher MUST rest on at least one identifiable factual basis present in or directly implied by the source text " +
  "(official availability, regional pricing, an African customer, partner, startup, investor, government policy, regulation, infrastructure deployment, " +
  "African language support, local adoption data, credible research, or reliable reporting linking the development to Africa). " +
  "If you cannot name such a basis, lower the score. Never fabricate statistics, partnerships, adoption claims, quotes or use cases.\n\n" +
  "Return ONLY strict JSON, no markdown:\n" +
  `{"score":0,"reason":"one sentence","evidence":["..."],"angle_type":"one of: ${AFRICA_ANGLE_TYPES.join(", ")} or null"}`;

/** Score a scraped story's African relevance. Falls back to score 0 on any failure. */
async function assessAfricaRelevance(
  title: string,
  sourceUrl: string,
  markdown: string,
): Promise<AfricaAssessment> {
  const fallback: AfricaAssessment = {
    score: 0, reason: "assessment unavailable", evidence: [], angle_used: false, angle_type: null,
  };
  try {
    const res: any = await callGemini({
      system: AFRICA_ASSESS_SYSTEM,
      userParts: [{ text: `Source URL: ${sourceUrl}\nTitle: ${title}\n\nSource content:\n${markdown.slice(0, 8000)}` }],
      json: true,
      temperature: 0.15,
    });
    const raw = geminiText(res).trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(raw) as { score?: unknown; reason?: unknown; evidence?: unknown; angle_type?: unknown };
    let score = Math.max(0, Math.min(5, Math.round(Number(parsed.score) || 0)));
    const evidence = Array.isArray(parsed.evidence)
      ? parsed.evidence.map((e) => String(e)).filter((e) => e.trim().length > 3).slice(0, 6)
      : [];
    const reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 500) : "";
    // Evidence gate: no named factual basis means no dedicated African analysis.
    if (score >= 3 && evidence.length === 0) score = 2;
    const angleTypeRaw = typeof parsed.angle_type === "string" ? parsed.angle_type.trim() : "";
    const angle_type = AFRICA_ANGLE_TYPES.includes(angleTypeRaw) ? angleTypeRaw : null;
    return { score, reason, evidence, angle_used: score >= 2, angle_type };
  } catch {
    return fallback;
  }
}

/** Shared Firecrawl search -> formatted notes helper, used by the Africa
 *  angle research and the general corroboration research below. */
async function webSearchNotes(fc: any, query: string, limit: number): Promise<string> {
  try {
    const searchRes: any = await fc.search(query.slice(0, 220), { limit });
    const results: any[] = searchRes?.web ?? searchRes?.data ?? [];
    return results
      .map((r: any) => {
        const desc = String(r?.description ?? "").trim();
        return desc ? `- ${String(r?.title ?? "").trim()}: ${desc} (${r?.url ?? ""})` : "";
      })
      .filter(Boolean)
      .slice(0, 5)
      .join("\n");
  } catch {
    return "";
  }
}

/** One targeted search into the African dimension of a story scoring 3+. */
async function researchAfricaAngle(
  fc: any,
  title: string,
  assessment: AfricaAssessment,
): Promise<string> {
  const focusBits = [assessment.angle_type, ...assessment.evidence.slice(0, 2)].filter(Boolean).join(" ");
  return webSearchNotes(fc, `${title} Africa ${focusBits}`, 5);
}

// ============ GENERAL CORROBORATION RESEARCH ============
// Unlike the Africa-angle research above (targeted, Africa-relevant stories
// only), this pulls a second outlet's coverage of the SAME event for
// high-value or single-source-thin stories, so drafts aren't built from one
// outlet's framing alone. Bounded to one search per qualifying candidate to
// keep the added Firecrawl calls and latency proportionate.
const CORROBORATION_NEWSWORTHINESS_MIN = 70;
const CORROBORATION_THIN_WORDS = 900;

// ============ SELF-CORRECTION QA PASS ============
// A fresh model pass (not the same call that wrote or polished the draft)
// checks the finished draft against its source before it's ever inserted,
// catching what validateDraft's length/title checks can't: banned phrases,
// missing required structure, an unsupported/fabricated claim, or a source
// link that doesn't match. Fixable issues get one targeted Claude revision;
// a critical issue (fabrication, wrong source link) skips the candidate
// instead of publishing a flawed draft.

const QA_CRITIQUE_SYSTEM =
  "You are Cognarah's copy chief doing a final pre-publish check. Compare the draft strictly against the SOURCE content and these hard rules:\n" +
  "1. Headline: max 12 words, names a specific actor and action, no clickbait.\n" +
  "2. Dek: 20-40 words, states at least one concrete fact (name, number, or date) from the source.\n" +
  "3. Body contains, in order: an opening paragraph with who/what/why, reported context paragraphs, then exactly one <h2>The Cognarah Angle</h2> section, then a closing punchy line, then the 'Reporting sourced from' footer link pointing at the exact given Source URL.\n" +
  "4. Every factual claim, number, quote or name in the reported (non-Angle) sections must be traceable to the SOURCE content or the ADDITIONAL RESEARCH notes if provided. Flag anything that looks fabricated or unsupported.\n" +
  "5. Banned phrases anywhere: 'groundbreaking', 'revolutionary', 'game-changing', 'the future is here', 'this could transform businesses across Africa', 'a major opportunity for African startups', 'African businesses could benefit significantly', 'this could accelerate digital transformation across the continent'.\n" +
  "6. If an African angle is present, it must match the supplied AFRICAN RELEVANCE POLICY score (do not flag if no policy given, or if score <= 1 and no angle is present).\n" +
  "Return ONLY strict JSON: {\"pass\":true|false,\"issues\":[\"specific, actionable issue\"],\"critical\":true|false}. " +
  "critical=true only when a claim is fabricated/unsupported or the source link is wrong, i.e. not safely fixable by a copy edit.";

interface QaCritique { pass: boolean; issues: string[]; critical: boolean }

/** Never blocks the run if the check itself fails; returns pass=true in that case. */
async function qaCritiqueDraft(
  draft: DraftPayload,
  sourceUrl: string,
  sourceMarkdown: string,
  corroborationNotes: string,
  africa: AfricaAssessment,
): Promise<QaCritique> {
  try {
    const res: any = await callGemini({
      system: QA_CRITIQUE_SYSTEM,
      userParts: [{
        text: `Source URL: ${sourceUrl}\n\nSOURCE content:\n${sourceMarkdown.slice(0, 8000)}\n\n` +
          (corroborationNotes ? `ADDITIONAL RESEARCH:\n${corroborationNotes}\n\n` : "") +
          `AFRICAN RELEVANCE POLICY: score ${africa.score}, angle_used=${africa.angle_used}\n\n` +
          `DRAFT JSON:\n${JSON.stringify(draft)}`,
      }],
      json: true,
      temperature: 0.15,
    });
    const raw = geminiText(res).trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(raw) as { pass?: unknown; issues?: unknown; critical?: unknown };
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.map((i) => String(i)).filter(Boolean).slice(0, 8)
      : [];
    return { pass: parsed.pass === true && issues.length === 0, issues, critical: parsed.critical === true };
  } catch {
    return { pass: true, issues: [], critical: false };
  }
}

/** Per-story drafting instructions derived from the relevance score. */
function africaStructureInstruction(a: AfricaAssessment): string {
  const common =
    "AFRICAN RELEVANCE POLICY FOR THIS STORY (overrides any general Africa guidance):\n" +
    `Assessed africa_relevance_score = ${a.score}. Reason: ${a.reason || "n/a"}.\n` +
    (a.evidence.length ? `Supporting evidence: ${a.evidence.join("; ")}.\n` : "") +
    (a.research_notes ? `Targeted African research findings (use only what is supportable):\n${a.research_notes}\n` : "") +
    "Never fabricate statistics, adoption data, partnerships, quotes or African use cases. " +
    "Never write generic continent-wide claims such as 'this could transform businesses across Africa' or 'a major opportunity for African startups' unless the article states the specific evidence that makes it true. " +
    "Africa is not one homogeneous market: name specific countries, industries, companies or user groups where relevant.\n";

  if (a.score <= 1) {
    return common +
      "STRUCTURE: Global story, explanation, significance, key takeaway. " +
      "Do NOT mention Africa at all. Do NOT write an African context or implications section. " +
      "The <h2>The Cognarah Angle</h2> section is still required, but it is Cognarah's own analysis of the story's significance, NOT an African angle. It must not reference Africa.\n";
  }
  if (a.score === 2) {
    return common +
      "STRUCTURE: Global story, explanation, significance, key takeaway. " +
      "You may include at most ONE brief contextual sentence about African relevance inside the Cognarah Angle, and only if genuinely useful. " +
      "Do NOT create a dedicated African section and do NOT exaggerate the significance.\n";
  }
  if (a.score >= 5) {
    return common +
      "STRUCTURE: Africa is central to this story. Integrate the African context naturally throughout the whole article. " +
      "Do NOT isolate the African material into an artificial final section.\n";
  }
  return common +
    "STRUCTURE: Global story, explanation, significance, then a dedicated evidence-supported African section, then the key takeaway. " +
    "The African section must have its own <h3> heading written specifically for this story, for example 'What This Means for African Developers', 'Availability in Africa', 'Impact on African Fintech' or 'Implications for African Regulators'. " +
    "Do NOT use the default heading 'What This Means for Africa'. " +
    "Explain specifically who is affected, how and why, and ground every claim in the evidence above.\n";
}

/** Matching constraint handed to the Claude editor pass. */
function africaEditorConstraint(a: AfricaAssessment): string {
  if (a.score <= 1) {
    return "AFRICAN RELEVANCE: this story has no meaningful African dimension. Do NOT add any African commentary, and remove any generic African claims if present. The Cognarah Angle stays as Cognarah's own analysis without an Africa angle. ";
  }
  if (a.score === 2) {
    return "AFRICAN RELEVANCE: limited and indirect. Keep at most one brief contextual African sentence. Do NOT expand it into a section or add generic continent-wide claims. ";
  }
  if (a.score >= 5) {
    return "AFRICAN RELEVANCE: Africa is central to this story. Keep the African context woven through the article rather than isolated at the end. ";
  }
  return "AFRICAN RELEVANCE: keep the dedicated, evidence-supported African section and its story-specific heading. Do NOT add unsupported claims and do NOT replace the heading with a generic 'What This Means for Africa'. ";
}


const SYSTEM_PROMPT =
  "You are the AI drafting agent for Cognarah, an African-first AI media publication based in Lagos, Nigeria. Your tagline is 'Everything AI. Nothing Else.'\n\n" +
  "Cognarah covers artificial intelligence news, startups, funding rounds, tools, trends, policy, ethics, and events. The target audience spans African tech professionals, founders, investors, policymakers, and curious beginners globally.\n\n" +
  "VOICE AND TONE\n" +
  "- Write like a smart, informed journalist, not a press release.\n" +
  "- Confident but not arrogant. Clear but not simplistic.\n" +
  "- Avoid hype, superlatives, and buzzword stacking.\n" +
  "- Never say 'groundbreaking', 'revolutionary', 'game-changing', or 'the future is here'.\n" +
  "- Use active voice. Short sentences. One idea per paragraph.\n" +
  "- Write for someone intelligent but not necessarily deeply technical.\n" +
  "- Never use em dashes (em dash) anywhere in articles. Use commas, periods, or semicolons instead.\n" +
  "- AGENT RULE: If an em dash appears in any draft, replace it before saving. It is not permitted in any Cognarah content.\n\n" +
  "ARTICLE STRUCTURE (every draft must follow this):\n" +
  "1. Headline: clear, specific, direct. No clickbait, no controversy in the headline itself. Tells the reader exactly what happened. Max 12 words.\n" +
  "2. Opening paragraph: the most important facts in 2-3 sentences. Answer who, what, and why it matters. No throat-clearing. Straight reporting, tied to the source.\n" +
  "3. Body: 3-5 short paragraphs expanding the story with context, numbers, and named sources where available. This is straight reporting. Any external fact, number, quote, or claim in this section must be tied to the source (inline link or clear attribution). Keep Cognarah opinion OUT of these paragraphs.\n" +
  "4. Cognarah Angle: begin this section with the exact subheading <h2>The Cognarah Angle</h2>. This is Cognarah's own analysis, not reporting. At least one paragraph explaining what the development actually means and why it matters. Whether it carries an African angle is decided per story by the AFRICAN RELEVANCE POLICY supplied with the story; follow that policy exactly and never add an African angle it does not authorise. Do NOT cite, link, or attribute anything in this section to the source publication. If it references outside facts (a named bill, a named startup, a data point), name them plainly but do not credit the news source for that context.\n" +
  "5. Closing line: one punchy sentence that leaves the reader with a pointed question or a sharp opinion. No summaries. No 'time will tell'. No both-sides mush.\n\n" +
  "ARTICLE LENGTH (HARD REQUIREMENT, subordinate to FACTUAL ACCURACY in SOURCING below)\n" +
  "- News articles: minimum 500 words, target 500-700.\n" +
  "- Analysis or opinion pieces: minimum 800 words, target 800-1300.\n" +
  "- If the source is thin, expand through explanation, background, and a DEEPER Cognarah Angle: more on why this matters, how it fits the wider AI landscape, what plausibly follows next. Do NOT expand by inventing reported facts, numbers, dollar figures, technical specs, named partners, deals, or quotes. A shorter but 100% accurate article always beats one that hits the word count with a single fabricated specific.\n\n" +
  "WHAT TO COVER (prioritize stories meeting at least one):\n" +
  "- Major AI model releases or research breakthroughs.\n" +
  "- AI startup funding rounds, especially African ones.\n" +
  "- AI policy, regulation, or government announcements.\n" +
  "- Practical AI tools professionals or businesses can use today.\n" +
  "- African startups or companies building with or around AI.\n" +
  "- Big Tech AI moves that affect emerging markets.\n\n" +
  "WHAT TO AVOID\n" +
  "- Speculative stories with no named sources or data.\n" +
  "- Stories more than 48 hours old.\n" +
  "- Anything already covered by Cognarah in a previous draft.\n" +
  "- Generic 'AI is changing everything' takes with no specific news peg.\n" +
  "- Purely speculative framing with no news peg.\n\n" +
  "HEADLINE EXAMPLES\n" +
  "- Bad: 'Artificial Intelligence Is Transforming the Way We Work Forever'. Good: 'OpenAI Launches GPT-5 With Real-Time Voice and Vision Capabilities'.\n" +
  "- Bad: 'This New AI Tool Could Change Everything for African Businesses'. Good: 'Nigerian Startup Lendsqr Adds AI Credit Scoring for Underbanked Users'.\n\n" +
  "SOURCING (scope this carefully)\n" +
  "- The Opening paragraph and Body are reported news. Cite the original source there, either inline or via the footer link. If a claim in these sections cannot be verified from the SOURCE content or the ADDITIONAL CORROBORATING RESEARCH notes when provided, do not include it, full stop, even if it would make the article feel more complete or help reach the word count.\n" +
  "- FACTUAL ACCURACY (highest priority, overrides ARTICLE LENGTH): never state a specific number, dollar figure, date, statistic, technical spec, named partner, deal, or quote in the reported sections unless it appears in the SOURCE content or ADDITIONAL CORROBORATING RESEARCH. Do not draw on general or background knowledge for specifics, even if it sounds plausible or you believe it's probably true. Before finishing, re-check every specific claim in the Body against that text; if you cannot point to where it came from, cut it or rewrite the sentence without it.\n" +
  "- The Cognarah Angle and Closing line are Cognarah's own voice and analysis. Do NOT attribute them to the source publication. No 'according to TechCrunch' inside the Cognarah Angle.\n" +
  "- Attribute quotes directly. Never paraphrase a quote and present it as direct speech.\n\n" +
  "AFRICAN RELEVANCE (core editorial rule: Cognarah is African-first, not Africa-forced)\n" +
  "- Cognarah covers important AI developments globally. Not every global story needs an African angle.\n" +
  "- Each story arrives with an assessed africa_relevance_score and a structure instruction. That instruction is binding.\n" +
  "- Never add an African perspective merely to maintain positioning. An article with no African angle is perfectly acceptable when there is no real African dimension.\n" +
  "- When an African angle IS authorised, make it specific and evidence-backed: name the countries, sectors, companies, regulators or user groups involved. Nigeria, Kenya, South Africa, Egypt and Ghana differ in infrastructure, regulation and adoption. Be specific.\n" +
  "- Banned generic filler: 'this could transform businesses across Africa', 'a major opportunity for African startups', 'African businesses could benefit significantly', 'this could accelerate digital transformation across the continent'. Such claims are allowed only when the article states exactly why they are true.\n" +
  "- Priorities in order: accuracy, newsworthiness, clear explanation, credible sourcing, context, practical significance, then African relevance where genuinely applicable. Never sacrifice accuracy or quality to establish an African connection.\n\n" +

  "EDITORIAL EDGE (required)\n" +
  "- Take a clear, defensible stance in the Cognarah Angle. No fence-sitting, no 'time will tell', no both-sides mush.\n" +
  "- Include one provocative question or contrarian observation per piece that challenges the dominant narrative. Examples: 'Why should African founders trust a US-regulated model with local user data?' or 'Is this really a win for Africa, or just cheaper extraction dressed up as opportunity?'.\n" +
  "- Guardrails: any provocation must be grounded in a fact stated earlier in the article. No personal attacks. No unverified accusations. No invented quotes. No defamation of named people or companies. No inflammatory language about ethnicity, religion, or nationality.\n" +
  "- Controversy lives ONLY in the Cognarah Angle and Closing line. The Headline, Opening paragraph, and Body stay straight, factual, and neutral.\n\n" +
  "DRAFT ONLY, never publish directly. Do not include an author name; it will be assigned manually.\n\n" +
  "OUTPUT FORMAT: Return ONLY strict JSON (no markdown, no code fences) matching this shape. Map fields as follows: `title` = Headline, `dek` = the opening paragraph (20-40 words summarizing who/what/why), `body_html` = the full Body followed by the <h2>The Cognarah Angle</h2> subheading, the Cognarah Angle paragraphs, the closing line, and the source footer, `category_slug` = Category. The body must be clean HTML using only: p, h2, h3, ul, ol, li, strong, em, blockquote, a. End the body with: <p><em>Reporting sourced from</em> <a href=\"SOURCE_URL\">Publication name</a>. Analysis and Cognarah Angle are Cognarah's own.</p>.\n" +
  `{"title":"...","dek":"...","body_html":"<p>...</p><h2>The Cognarah Angle</h2><p>...</p><p><em>Reporting sourced from</em> <a href=\"SOURCE_URL\">Publication</a>. Analysis and Cognarah Angle are Cognarah's own.</p>","tags":["...","..."],"seo_title":"...","meta_description":"...","category_slug":"one of: ${CATEGORY_HINTS.join(", ")}"}`;

// ============ NEWSWORTHINESS FILTER ============
// Multi-criteria scoring (novelty/credibility/impact/specificity, each 0-25)
// instead of one holistic 0-100 number: a story that's high-impact but
// low-credibility (a hyped rumor) is visible and gated on that dimension
// specifically, not averaged away by an otherwise-strong score. Source tier
// is handed to the model as scoring context, not a hard filter — an unknown
// source isn't rejected, it's held to a higher evidentiary bar for the
// CREDIBILITY dimension.

const NEWSWORTHINESS_MIN = 45;
const CREDIBILITY_FLOOR = 5; // out of 25 — an unreliable/unverified claim is rejected regardless of total score.

// Known, reputable outlets. A signal for the CREDIBILITY dimension, not a
// hard allowlist — unlisted sources can still score well on their own merit.
const TIER1_HOSTS = new Set([
  "techcrunch.com", "www.techcrunch.com", "wired.com", "www.wired.com",
  "theverge.com", "www.theverge.com", "reuters.com", "www.reuters.com",
  "bloomberg.com", "www.bloomberg.com", "ft.com", "www.ft.com",
  "wsj.com", "www.wsj.com", "axios.com", "www.axios.com",
  "semafor.com", "www.semafor.com", "restofworld.org", "www.restofworld.org",
  "venturebeat.com", "www.venturebeat.com", "cnbc.com", "www.cnbc.com",
  "bbc.com", "www.bbc.com", "bbc.co.uk", "www.bbc.co.uk",
  "arstechnica.com", "www.arstechnica.com", "theinformation.com", "www.theinformation.com",
]);

// Primary-source company/lab blogs: reliable for their own announcements,
// but carry an obvious promotional interest worth flagging to the model.
const TIER1_PRIMARY_HOSTS = new Set([
  "openai.com", "www.openai.com", "anthropic.com", "www.anthropic.com",
  "deepmind.google", "blog.google", "ai.meta.com", "aws.amazon.com",
  "azure.microsoft.com", "blogs.microsoft.com", "huggingface.co",
  "nvidia.com", "blogs.nvidia.com",
]);

type SourceTier = "tier1" | "primary" | "unknown";

function sourceTier(url: string): SourceTier {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (TIER1_HOSTS.has(host)) return "tier1";
    if (TIER1_PRIMARY_HOSTS.has(host)) return "primary";
    return "unknown";
  } catch {
    return "unknown";
  }
}

const NEWSWORTHINESS_SYSTEM =
  "You are Cognarah's news desk editor. Score a candidate story for an African-first AI publication across four dimensions, each 0-25:\n\n" +
  "NOVELTY (0-25): how new is this. 25 = breaking, not yet widely reported. 15 = recent but already covered elsewhere. 0 = old news, recycled coverage.\n" +
  "CREDIBILITY (0-25): how reliable is THIS claim. Weigh the given source tier AND content signals: named actors, on-record quotes, official statements, verifiable data. 25 = official announcement or on-record reporting with named sources. 10 = plausible but relies on unnamed sources or a single outlet's claim. 0 = rumor, speculation, or no verifiable basis.\n" +
  "IMPACT (0-25): how much this actually changes for readers. 25 = a genuine development that changes something (new model/product, funding round, acquisition, regulation, research breakthrough, major partnership, incident, verifiable adoption data). 10 = incremental (feature update, minor release, executive commentary with substance). 0 = no real-world consequence (opinion column, listicle, how-to, sponsored or promotional post, product review).\n" +
  "SPECIFICITY (0-25): concrete facts vs vague. 25 = named actor, numbers, dates, verifiable claims. 0 = no named actor, no date, no numbers, no verifiable claim.\n\n" +
  "Return ONLY strict JSON, no markdown:\n" +
  '{"novelty":0,"credibility":0,"impact":0,"specificity":0,"reason":"one sentence naming the weakest dimension and why","story_key":"short canonical description of the underlying event, max 12 words"}';

interface Newsworthiness {
  score: number;
  novelty: number;
  credibility: number;
  impact: number;
  specificity: number;
  reason: string;
  story_key: string;
  source_tier: SourceTier;
}

/** Score a scraped story 0-100 (sum of 4 sub-scores). On failure returns a
 *  neutral score so the run continues. */
export async function assessNewsworthiness(
  title: string,
  sourceUrl: string,
  markdown: string,
): Promise<Newsworthiness> {
  const tier = sourceTier(sourceUrl);
  const tierNote = tier === "tier1"
    ? "This source is a known, reputable outlet."
    : tier === "primary"
      ? "This source is the company/lab publishing about its own work: highly reliable for its own announcements, but has an obvious promotional interest."
      : "This source is not on the known-reputable list. Hold CREDIBILITY to a higher bar: require named actors or verifiable, corroborating detail in the text itself, not just the outlet's say-so.";
  try {
    const res: any = await callGemini({
      system: NEWSWORTHINESS_SYSTEM,
      userParts: [{
        text: `Source URL: ${sourceUrl}\nSource tier: ${tier}. ${tierNote}\nTitle: ${title}\n\nSource content:\n${markdown.slice(0, 8000)}`,
      }],
      json: true,
      temperature: 0.15,
    });
    const raw = geminiText(res).trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(raw) as {
      novelty?: unknown; credibility?: unknown; impact?: unknown; specificity?: unknown;
      reason?: unknown; story_key?: unknown;
    };
    const clamp25 = (v: unknown) => Math.max(0, Math.min(25, Math.round(Number(v) || 0)));
    const novelty = clamp25(parsed.novelty);
    const credibility = clamp25(parsed.credibility);
    const impact = clamp25(parsed.impact);
    const specificity = clamp25(parsed.specificity);
    return {
      score: novelty + credibility + impact + specificity,
      novelty, credibility, impact, specificity,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 400) : "",
      story_key: typeof parsed.story_key === "string" ? parsed.story_key.slice(0, 160) : title.slice(0, 160),
      source_tier: tier,
    };
  } catch {
    // Neutral, passing sub-scores so an assessment-call failure doesn't
    // block the run — but this only happens when the check itself errored,
    // not as a way to skip real scoring.
    return {
      score: 60, novelty: 15, credibility: 15, impact: 15, specificity: 15,
      reason: "newsworthiness assessment unavailable", story_key: title.slice(0, 160), source_tier: tier,
    };
  }
}

// ============ DUPLICATE STORY PROTECTION ============

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "by", "at", "from",
  "its", "it", "as", "is", "are", "was", "were", "be", "has", "have", "had", "that", "this",
  "new", "says", "said", "after", "over", "into", "amid", "will", "can", "how", "why", "what",
  "ai", "artificial", "intelligence",
]);

function keyTokens(text: string): Set<string> {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

const DUPLICATE_SYSTEM =
  "You decide whether two headlines describe the SAME underlying news event.\n" +
  "Same event means the same actor doing the same thing at the same time, even if the wording differs.\n" +
  "A follow-up with genuinely new facts is NOT the same event. A different company doing something similar is NOT the same event.\n" +
  'Return ONLY strict JSON: {"duplicate":true,"of":"the matching existing headline","reason":"one short sentence"}';

interface DuplicateCheck { duplicate: boolean; of?: string; reason?: string }

/**
 * Two-stage duplicate protection: cheap token overlap against recent articles,
 * then a Gemini semantic confirmation on the closest matches only.
 */
async function checkDuplicateStory(
  supabase: any,
  candidateTitle: string,
  storyKey: string,
): Promise<DuplicateCheck> {
  try {
    const since = new Date(Date.now() - 21 * 86400000).toISOString();
    const { data: recent } = await supabase
      .from("articles")
      .select("title, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(120);
    const existing: string[] = (recent ?? []).map((r: any) => String(r.title ?? "")).filter(Boolean);
    if (existing.length === 0) return { duplicate: false };

    const candTokens = keyTokens(`${candidateTitle} ${storyKey}`);
    const scored = existing
      .map((t) => ({ title: t, overlap: tokenOverlap(candTokens, keyTokens(t)) }))
      .sort((a, b) => b.overlap - a.overlap);

    // Near-identical headlines: reject without spending a model call.
    if (scored[0] && scored[0].overlap >= 0.8) {
      return { duplicate: true, of: scored[0].title, reason: "near identical headline already covered" };
    }

    const near = scored.filter((s) => s.overlap >= 0.35).slice(0, 6);
    if (near.length === 0) return { duplicate: false };

    const res: any = await callGemini({
      system: DUPLICATE_SYSTEM,
      userParts: [{
        text: `Candidate story: ${candidateTitle}\nCandidate event: ${storyKey}\n\nExisting Cognarah headlines from the last 21 days:\n${near.map((n) => `- ${n.title}`).join("\n")}`,
      }],
      json: true,
      temperature: 0.1,
    });
    const raw = geminiText(res).trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(raw) as DuplicateCheck;
    return {
      duplicate: parsed.duplicate === true,
      of: typeof parsed.of === "string" ? parsed.of.slice(0, 200) : undefined,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : undefined,
    };
  } catch {
    // Never block a run because the duplicate check failed.
    return { duplicate: false };
  }
}


/**
 * Reaper: mark stalled agent runs as failed so the UI stops spinning on them.
 * A run is stalled when its heartbeat is older than 5 minutes (mid-pipeline
 * hang) or it started > 15 minutes ago with no heartbeat at all.
 * Best-effort: never throws.
 */
export async function reapStuckRuns(supabase: any): Promise<void> {
  try {
    const heartbeatCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const startCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await supabase
      .from("agent_runs")
      .update({
        status: "error",
        error: "Stalled: no heartbeat",
        finished_at: new Date().toISOString(),
      })
      .eq("status", "running")
      .lt("last_heartbeat_at", heartbeatCutoff);
    await supabase
      .from("agent_runs")
      .update({
        status: "error",
        error: "Stalled: no heartbeat (never started)",
        finished_at: new Date().toISOString(),
      })
      .eq("status", "running")
      .is("last_heartbeat_at", null)
      .lt("started_at", startCutoff);
  } catch { /* best-effort cleanup */ }
}

export async function runAgentCore(args: RunAgentArgs) {
  const { supabase } = args;
  const log: string[] = [];
  const logLine = (m: string) => { log.push(`[${new Date().toISOString()}] ${m}`); };

  // 0. Reap stuck runs from previous crashes.
  await reapStuckRuns(supabase);

  // 1. Create run row (or reuse a pre-created one so background runs share the id the client already has).
  let runId: string;
  if (args.existingRunId) {
    runId = args.existingRunId;
    // Make sure the row reflects that work has started (was inserted as "running" by caller, but be defensive).
    await supabase
      .from("agent_runs")
      .update({ status: "running", started_at: new Date().toISOString(), last_heartbeat_at: new Date().toISOString() })
      .eq("id", runId);
  } else {
    const { data: runRow, error: runErr } = await supabase
      .from("agent_runs")
      .insert({
        triggered_by: args.triggeredBy,
        trigger: args.trigger,
        status: "running",
        requested_count: args.count,
        focus: args.focus,
        last_heartbeat_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (runErr) throw new Error(runErr.message);
    runId = runRow.id as string;
  }
  const runStartedAt = Date.now();
  const RUN_MAX_MS = 10 * 60 * 1000; // hard 10 min wall-clock ceiling
  let modelUnavailable = false;
  let modelUnavailableMsg = "";

  const heartbeat = async (stage: string) => {
    logLine(`heartbeat: ${stage}`);
    try {
      await supabase
        .from("agent_runs")
        .update({ last_heartbeat_at: new Date().toISOString() })
        .eq("id", runId);
    } catch { /* best-effort */ }
  };

  // Write an initial log entry immediately so a run that dies early still
  // leaves a trace in the database.
  logLine(`Started: trigger=${args.trigger}, requested=${args.count}${args.focus ? `, focus=${args.focus}` : ""}`);
  try {
    await supabase
      .from("agent_runs")
      .update({ log: log.join("\n"), last_heartbeat_at: new Date().toISOString() })
      .eq("id", runId);
  } catch { /* best-effort */ }


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
    await heartbeat("settings loaded");

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

    // 4. Search via Firecrawl, one query per domain when configured, plus generic recent queries.
    if (!process.env.FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY missing, link Firecrawl in Connectors.");
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
    await heartbeat(`search complete (${candidates.length} candidates)`);


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
    const fresh = hashes.filter((h) => !seenHashes.has(h.hash)).slice(0, 15);
    logLine(`${fresh.length} fresh after dedupe (capped at 15, trusted domains prioritized)`);

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

    // 7. Concurrent worker pool. Firecrawl scrape starts are throttled to
    //    SCRAPE_INTERVAL_MS apart; Gemini/Claude calls run in parallel and
    //    self-retry on 429. Workers stop pulling as soon as `created >= target`.
    const target = Math.min(args.count, fresh.length);
    const CONCURRENCY = 3;
    const SCRAPE_INTERVAL_MS = 1500;
    let created = 0;
    let nextIdx = 0;
    let scrapeChain: Promise<unknown> = Promise.resolve();
    const acquireScrapeSlot = async () => {
      const prev = scrapeChain;
      scrapeChain = prev.then(() => sleep(SCRAPE_INTERVAL_MS));
      await scrapeChain;
    };

    async function processCandidate(cand: (typeof fresh)[number]) {
      try {
        if (modelUnavailable || created >= target || Date.now() - runStartedAt > RUN_MAX_MS) return;
        await acquireScrapeSlot();
        if (modelUnavailable || created >= target || Date.now() - runStartedAt > RUN_MAX_MS) return;
        logLine(`Scraping: ${cand.url}`);
        await heartbeat(`scraping ${cand.url}`);
        const scraped: any = await fc.scrape(cand.url, {
          formats: ["markdown"],
          onlyMainContent: true,
        });
        const md: string = scraped?.markdown || scraped?.data?.markdown || "";
        const meta: any = scraped?.metadata || scraped?.data?.metadata || {};
        const ogImg: string | undefined =
          meta.ogImage || meta["og:image"] || meta.twitterImage || meta["twitter:image"];

        const bodyWords = md.split(/\s+/).filter(Boolean).length;
        if (bodyWords < 600) { logLine(`Skipped: page has only ${bodyWords} words (not article)`); return; }
        // Broadened beyond the original 3 fields: sites vary in which meta
        // tag (if any) they set, and some only carry a modified-time or a
        // non-standard analytics-plugin date field.
        const published: string | undefined =
          meta.publishedTime || meta["article:published_time"] || meta.publishedDate ||
          meta.datePublished || meta["date"] || meta.modifiedTime || meta["article:modified_time"] ||
          meta.dateModified || meta["og:updated_time"] || meta.updatedTime ||
          meta["parsely-pub-date"] || meta["sailthru.date"];
        const hasUrlDate = /\/(19|20)\d{2}\//.test(cand.url);
        // Last resort: a written-out or ISO date visible in the page's own
        // text (many blog/support pages render a byline date with no
        // matching meta tag at all).
        const hasTextDate = TEXT_DATE_REGEX.test(md.slice(0, 2000));
        if (!published && !hasUrlDate && !hasTextDate) {
          logLine(`Skipped: no publication date on page, in URL, or near article top`);
          return;
        }

        // Newsworthiness filter: drop opinion pieces, listicles and promo posts early.
        await heartbeat("scoring newsworthiness");
        const news = await assessNewsworthiness(cand.title ?? meta.title ?? "", cand.url, md);
        logLine(
          `Newsworthiness: ${news.score}/100 (novelty ${news.novelty}, credibility ${news.credibility}, ` +
          `impact ${news.impact}, specificity ${news.specificity}, source_tier=${news.source_tier})` +
          `${news.reason ? ` — ${news.reason}` : ""}`,
        );
        // Credibility floor: a hyped-but-unreliable claim is rejected on that
        // dimension specifically, even if novelty/impact/specificity are high
        // enough to carry the total score past the threshold below.
        if (news.credibility < CREDIBILITY_FLOOR) {
          logLine(`Skipped: credibility below floor (${news.credibility} < ${CREDIBILITY_FLOOR}), unreliable/unverified claim`);
          return;
        }
        if (news.score < NEWSWORTHINESS_MIN) {
          logLine(`Skipped: below newsworthiness threshold (${news.score} < ${NEWSWORTHINESS_MIN})`);
          return;
        }

        // Duplicate story protection against the last 21 days of coverage.
        const dup = await checkDuplicateStory(supabase, cand.title ?? meta.title ?? "", news.story_key);
        if (dup.duplicate) {
          logLine(`Skipped: duplicate story${dup.of ? ` of "${dup.of}"` : ""}${dup.reason ? ` (${dup.reason})` : ""}`);
          // Remember the URL so the same source is not re-fetched next run.
          try {
            await supabase.from("agent_seen_sources").insert({
              url_hash: hashUrl(cand.url), url: cand.url, run_id: runId,
            });
          } catch { /* best-effort */ }
          return;
        }


        // African relevance assessment happens after verification and before drafting.
        await heartbeat("assessing african relevance");
        const africa = await assessAfricaRelevance(cand.title ?? meta.title ?? "", cand.url, md);
        logLine(`Africa relevance: ${africa.score}/5${africa.reason ? ` (${africa.reason})` : ""}`);
        if (africa.score >= 3) {
          const notes = await researchAfricaAngle(fc, cand.title ?? meta.title ?? "", africa);
          if (notes) {
            africa.research_notes = notes;
            logLine("Targeted African research completed");
          } else {
            // No supporting research found: downgrade rather than speculate.
            africa.score = 2;
            africa.angle_type = null;
            logLine("No African research evidence found, downgraded score to 2");
          }
        }
        africa.angle_used = africa.score >= 2;
        const africaInstruction = africaStructureInstruction(africa);

        // General corroboration research: a second outlet's coverage of the
        // same event, for high-value stories or ones where the scraped page
        // is thin on specifics. Generalizes the Africa-only research above
        // to every story, capped at one search to bound cost.
        let corroborationNotes = "";
        if (news.score >= CORROBORATION_NEWSWORTHINESS_MIN || bodyWords < CORROBORATION_THIN_WORDS) {
          await heartbeat("corroboration research");
          corroborationNotes = await webSearchNotes(fc, news.story_key || cand.title || meta.title || "", 5);
          if (corroborationNotes) logLine("Corroboration research completed");
        }

        const buildUserPrompt = (nudge?: string) =>
          `Focus: ${focusPart}\nSource URL: ${cand.url}\nSource title: ${cand.title ?? meta.title ?? ""}\n\n${africaInstruction}\n` +
          (corroborationNotes
            ? `ADDITIONAL CORROBORATING RESEARCH (other outlets on this same story; use only to verify facts or add supporting context, the source you cite/link stays the PRIMARY source below):\n${corroborationNotes}\n\n`
            : "") +
          `Source content:\n${md.slice(0, 12000)}` +
          (nudge ? `\n\nEDITOR NOTE: ${nudge}` : "");

        let draft: DraftPayload | null = null;
        let attempts = 0;
        let lastWords = 0;
        let lastReason = "";
        for (let i = 0; i < 2; i++) {
          attempts++;
          const nudge = i === 0
            ? undefined
            : `Your previous draft was ${lastWords} words and failed with: ${lastReason}. Rewrite to AT LEAST 500 words by making the Cognarah Angle deeper and more substantive (more context, more analysis, more of what plausibly follows), NOT by adding new reported facts, numbers or details to the Body beyond what the SOURCE content or ADDITIONAL CORROBORATING RESEARCH actually states. Do not invent facts and do not add an African angle beyond what the AFRICAN RELEVANCE POLICY allows. Ensure a specific actor+action headline and a dek containing at least one concrete fact (name, number, or date) that is genuinely in the source.`;
          const aiRes: any = await callGemini({
            system: SYSTEM_PROMPT,
            userParts: [{ text: buildUserPrompt(nudge) }],
            json: true,
            // Lower than the API default: still enough range for editorial
            // voice and prose quality, but curbs the tendency to invent
            // specifics observed at default temperature.
            temperature: 0.55,
          });

          const content: string = geminiText(aiRes);
          let parsed: DraftPayload;
          try { parsed = JSON.parse(content); } catch { logLine(`Attempt ${attempts}: non-JSON response`); lastReason = "non-JSON response"; continue; }
          const v = validateDraft(parsed);
          lastWords = v.words;
          if (v.ok) { draft = parsed; logLine(`Draft accepted: ${v.words} words (attempt ${attempts})`); await heartbeat("gemini draft accepted"); break; }
          lastReason = v.reason;
          logLine(`Attempt ${attempts} failed validation: ${v.reason}`);
        }
        if (!draft) { logLine("Skipped: could not produce valid draft after 2 attempts"); return; }

        const refined = await refineWithClaude(draft, cand.url, africa);
        if (refined) {
          draft = refined;
          logLine("Claude editor pass applied");
        } else {
          logLine("Claude editor pass skipped/failed, using Gemini draft");
        }
        await heartbeat("claude pass complete");

        // Self-correction QA pass: fresh-eyes check against the source before
        // this draft is ever inserted. A critical finding (fabricated claim,
        // wrong source link) gets one DELETION-focused correction pass rather
        // than an immediate skip: removing an unverifiable claim is always
        // safe, unlike trying to reword it into something that still sounds
        // sourced. Non-critical issues get a normal targeted fix. Either way
        // a recheck (and, since deletion can legitimately shorten the draft,
        // a length/structure re-validation) gates whether it proceeds.
        await heartbeat("qa critique");
        const qa = await qaCritiqueDraft(draft, cand.url, md, corroborationNotes, africa);
        if (!qa.pass) {
          logLine(`QA critique flagged: ${qa.issues.join("; ")}${qa.critical ? " (critical)" : ""}`);
          const fixIssues = qa.critical
            ? qa.issues.map((i) =>
                `This is unverifiable and MUST be deleted entirely, not reworded or softened: ${i}. ` +
                "If removing it noticeably shortens the Body, compensate by expanding the Cognarah Angle with more legitimate analysis, never by adding a new reported fact.")
            : qa.issues;
          const corrected = await refineWithClaude(draft, cand.url, africa, fixIssues);
          if (!corrected) {
            logLine(qa.critical
              ? "Deletion correction pass unavailable, skipping (critical issue unresolved)"
              : "QA correction pass failed/unavailable, proceeding with flagged draft (non-critical)");
            if (qa.critical) return;
          } else {
            draft = corrected;
            logLine(qa.critical ? "Applied deletion correction for critical QA issue(s)" : "Applied targeted QA correction pass");
            const recheck = await qaCritiqueDraft(draft, cand.url, md, corroborationNotes, africa);
            if (!recheck.pass && recheck.critical) {
              logLine(`Skipped: still critical after correction attempt: ${recheck.issues.join("; ")}`);
              return;
            }
            const lengthCheck = validateDraft(draft);
            if (!lengthCheck.ok) {
              logLine(`Skipped: draft fails length/structure requirements after QA correction (${lengthCheck.reason})`);
              return;
            }
            logLine(recheck.pass
              ? "QA recheck passed"
              : `QA still flags non-critical issues after correction, proceeding: ${recheck.issues.join("; ")}`);
          }
        } else {
          logLine("QA critique passed");
        }
        await heartbeat("qa complete");

        const stripDashes = (s: string | undefined | null) =>
          typeof s === "string" ? stripEmDashes(s) : s;
        const beforeDashCount = (JSON.stringify(draft).match(/[—–]/g) || []).length;
        if (beforeDashCount > 0) {
          draft = {
            ...draft,
            title: stripDashes(draft.title) as string,
            dek: stripDashes(draft.dek) as string,
            body_html: stripDashes(draft.body_html) as string,
            seo_title: stripDashes(draft.seo_title) as string,
            meta_description: stripDashes(draft.meta_description) as string,
          };
          logLine(`Stripped ${beforeDashCount} em/en dash(es) from draft`);
        }

        const slug = slugify(draft.title, { lower: true, strict: true }).slice(0, 110) + "-" + Date.now().toString(36);

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
                const rel = await isImageRelevant(dl.buf, dl.contentType, draft.title, draft.dek, ogImg);
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
          if ("buf" in aiImg) {
            heroPath = await uploadToMedia(aiImg.buf, "image/png", slug);
            logLine(heroPath ? "AI hero generated" : "AI hero upload failed");
          } else {
            logLine(`AI hero generation failed: ${aiImg.error}`);
          }
        }

        const category = overrideCategory
          || catBySlug.get(draft.category_slug)
          || catBySlug.get("latest")
          || (cats ?? [])[0];

        // Promotion score for the distribution queue, computed at draft time.
        const { computePromotionScore } = await import("./editorial.server");
        const promotion = computePromotionScore({
          title: draft.title,
          published_at: null,
          status: "draft",
          view_count: 0,
          tracked_views_7d: 0,
          newsworthiness_score: news.score,
          africa_relevance_score: africa.score,
          is_featured: false,
          hero_image: heroPath,
          body: draft.body_html,
          key_takeaways: [],
          tags: draft.tags ?? [],
          promotions_count: 0,
          last_promoted_at: null,
        });

        if (created >= target) return;

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
            africa_relevance_score: africa.score,
            africa_relevance_reason: africa.reason || null,
            africa_evidence: africa.evidence,
            africa_angle_used: africa.angle_used,
            africa_angle_type: africa.angle_type,
            newsworthiness_score: news.score,
            newsworthiness_reason: news.reason || null,
            promotion_score: promotion.score,
            promotion_reason: promotion.reason,
            promotion_signals: promotion.signals,
            promotion_generated_at: new Date().toISOString(),


          })
          .select("id")
          .single();
        if (insErr) { logLine(`Insert failed: ${insErr.message}`); return; }

        await supabase.from("agent_seen_sources").insert({
          url_hash: hashUrl(cand.url),
          url: cand.url,
          article_id: insertedArticle.id,
          run_id: runId,
        });
        created++;
        logLine(`Created draft (attempts=${attempts}): ${draft.title}`);
        await heartbeat(`draft created (${created}/${target})`);
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes(GEMINI_MODEL_UNAVAILABLE)) {
          modelUnavailable = true;
          modelUnavailableMsg = msg;
          logLine(`ABORT RUN: ${msg}. Update GEMINI_TEXT_MODEL / GEMINI_IMAGE_MODEL env or code.`);
          return;
        }
        logLine(`Candidate error: ${msg}`);
      }
    }

    async function worker() {
      while (created < target) {
        if (modelUnavailable || Date.now() - runStartedAt > RUN_MAX_MS) return;
        const i = nextIdx++;
        if (i >= fresh.length) return;
        await processCandidate(fresh[i]);
        // Small delay between articles to avoid bursting Gemini with concurrent requests.
        await sleep(1000);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, fresh.length) }, () => worker()));

    const finalError = modelUnavailable
      ? `Gemini model unavailable: ${modelUnavailableMsg}`
      : created === 0
        ? "No drafts created, see log"
        : null;
    await supabase
      .from("agent_runs")
      .update({
        status: created > 0 ? "success" : "error",
        drafts_created: created,
        log: log.join("\n"),
        finished_at: new Date().toISOString(),
        error: finalError,
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
