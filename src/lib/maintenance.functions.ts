import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * One-time backfill: sanitizes existing articles.body and
 * article_translations.translated_body rows written before sanitization
 * moved from render-time (article.$slug.tsx, removed) to write-time
 * (agent-core.server.ts, the admin article editor, startup-submissions.
 * functions.ts, translate.server.ts). Idempotent and safe to re-run —
 * sanitizeHtml() applied twice produces the same output, and only rows
 * whose sanitized result actually differs from what's stored get written.
 */
export const backfillSanitization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: roleErr } = await context.supabase.rpc("has_any_role", {
      _user_id: context.userId,
      _roles: ["admin"],
    });
    if (roleErr || !allowed) throw new Error("Forbidden");

    // Dynamic import: this is a .functions.ts file that ships to the client bundle, so
    // server-only modules must be loaded inside the handler, not imported at the top level.
    const { sanitizeHtml } = await import("./sanitize");
    const sb = context.supabase;

    let articlesChanged = 0;
    const { data: articles, error: articlesErr } = await sb.from("articles").select("id, body");
    if (articlesErr) throw new Error(articlesErr.message);
    for (const a of (articles ?? []) as Array<{ id: string; body: string | null }>) {
      const clean = sanitizeHtml(a.body ?? "");
      if (clean !== (a.body ?? "")) {
        const { error } = await sb.from("articles").update({ body: clean }).eq("id", a.id);
        if (!error) articlesChanged += 1;
      }
    }

    let translationsChanged = 0;
    const { data: translations, error: translationsErr } = await sb
      .from("article_translations")
      .select("id, translated_body");
    if (translationsErr) throw new Error(translationsErr.message);
    for (const t of (translations ?? []) as Array<{ id: string; translated_body: string | null }>) {
      const clean = sanitizeHtml(t.translated_body ?? "");
      if (clean !== (t.translated_body ?? "")) {
        const { error } = await sb.from("article_translations").update({ translated_body: clean }).eq("id", t.id);
        if (!error) translationsChanged += 1;
      }
    }

    return {
      articles_scanned: (articles ?? []).length,
      articles_changed: articlesChanged,
      translations_scanned: (translations ?? []).length,
      translations_changed: translationsChanged,
    };
  });
