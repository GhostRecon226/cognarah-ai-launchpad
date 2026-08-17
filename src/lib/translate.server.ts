import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { languageName } from "./languages";
import { stripEmDashes } from "./strip-em-dashes";

export interface TranslationResultImpl {
  languageCode: string;
  title: string;
  body: string;
  cached: boolean;
}

// Readers can generate this many brand new translations per hour.
export const TRANSLATION_RATE_LIMIT = 5;
// Articles older than this are served in English only, to cap translation spend on stale content.
export const TRANSLATION_MAX_AGE_DAYS = 90;

function cleanFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`translate:${ip}`).digest("hex").slice(0, 32);
}

function isTooOld(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  return ageMs > TRANSLATION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

export async function translateArticleImpl(
  slug: string,
  languageCode: string,
  ip: string,
): Promise<TranslationResultImpl> {
  const lang = languageCode.trim().toLowerCase();

  const { data: article, error: articleError } = await supabaseAdmin
    .from("articles")
    .select("id, title, body, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (articleError) throw new Error("Could not load this article.");
  if (!article) throw new Error("Article not found.");

  const { data: cached } = await supabaseAdmin
    .from("article_translations")
    .select("translated_title, translated_body")
    .eq("article_id", article.id)
    .eq("language_code", lang)
    .maybeSingle();

  if (cached) {
    return {
      languageCode: lang,
      title: cached.translated_title,
      body: cached.translated_body,
      cached: true,
    };
  }

  if (isTooOld(article.published_at)) {
    throw new Error(
      `This article is more than ${TRANSLATION_MAX_AGE_DAYS} days old, so it is available in English only.`,
    );
  }

  const ipHash = hashIp(ip || "unknown");
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("translation_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);

  if ((count ?? 0) >= TRANSLATION_RATE_LIMIT) {
    throw new Error(
      "You have reached the limit of 5 new translations per hour. Please try again later.",
    );
  }



  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("Translation is not available right now.");

  const target = languageName(lang);
  const prompt =
    `Translate the following news article into ${target}.\n\n` +
    "Rules:\n" +
    "1. Translate accurately. Do not add, remove, or reinterpret any facts, figures, names, dates, or quotes.\n" +
    "2. Preserve the journalistic tone, register, and editorial voice of the original.\n" +
    "3. The body is HTML. Keep every HTML tag, attribute, and link (href values) exactly as they are. Translate only the visible text.\n" +
    "4. Keep proper nouns, brand names, and product names in their original form.\n" +
    "5. Never use em dashes or en dashes. Use commas, periods, or semicolons instead.\n" +
    "6. Return ONLY strict JSON of the shape {\"title\": string, \"body\": string}. No markdown, no code fences, no commentary.\n\n" +
    `TITLE:\n${article.title}\n\nBODY HTML:\n${article.body}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system:
        "You are a professional news translator for Cognarah, an African-first AI media publication. You translate faithfully and never editorialise.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[translate] Claude error", res.status, detail.slice(0, 300));
    throw new Error("Translation failed. Please try again.");
  }

  const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  const text = Array.isArray(json.content)
    ? json.content
        .filter((b) => b?.type === "text")
        .map((b) => b.text ?? "")
        .join("")
    : "";

  let parsed: { title?: string; body?: string };
  try {
    parsed = JSON.parse(cleanFences(text));
  } catch {
    throw new Error("Translation failed. Please try again.");
  }

  const title = stripEmDashes(parsed.title ?? "").trim();
  const body = stripEmDashes(parsed.body ?? "").trim();
  if (!title || !body) throw new Error("Translation failed. Please try again.");

  const { error: insertError } = await supabaseAdmin
    .from("article_translations")
    .upsert(
      {
        article_id: article.id,
        language_code: lang,
        translated_title: title,
        translated_body: body,
      },
      { onConflict: "article_id,language_code" },
    );
  if (insertError) console.error("[translate] cache write failed", insertError.message);

  const { error: logError } = await supabaseAdmin.from("translation_requests").insert({
    ip_hash: ipHash,
    article_id: article.id,
    language_code: lang,
  });
  if (logError) console.error("[translate] rate limit log failed", logError.message);

  return { languageCode: lang, title, body, cached: false };
}

