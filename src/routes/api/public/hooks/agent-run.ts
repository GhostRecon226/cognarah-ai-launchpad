import { createFileRoute } from "@tanstack/react-router";

// Public hook: runs the AI news agent in a fresh worker invocation.
//
// Two callers:
//   1) pg_cron / scheduler: POST with an empty body -> uses agent_settings defaults.
//   2) The `runAgent` server function: POST with JSON body carrying a pre-created
//      run_id, count, focus, category_id, triggered_by. This is how manual runs
//      survive tab close: the browser request returns immediately after dispatching
//      here, and this route runs the actual pipeline in its own request lifetime.
//
// Auth: shared secret in `Authorization: Bearer <secret>` or `x-agent-cron-secret`.
export const Route = createFileRoute("/api/public/hooks/agent-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.AGENT_CRON_SECRET;
        const authHeader = request.headers.get("authorization") ?? "";
        const bearer = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
        const provided = bearer || request.headers.get("x-agent-cron-secret") || "";
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        // Parse optional JSON body. Empty body = scheduled invocation.
        let body: {
          run_id?: string;
          count?: number;
          focus?: string | null;
          category_id?: string | null;
          triggered_by?: string | null;
        } = {};
        try {
          const text = await request.text();
          if (text.trim()) body = JSON.parse(text);
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runAgentCore } = await import("@/lib/agent-core.server");

          if (body.run_id) {
            // Manual run dispatched from the admin UI.
            const result = await runAgentCore({
              supabase: supabaseAdmin,
              triggeredBy: body.triggered_by ?? null,
              trigger: "manual",
              count: Math.min(Math.max(body.count ?? 2, 1), 3),
              focus: body.focus ?? null,
              categoryId: body.category_id ?? null,
              existingRunId: body.run_id,
            });
            return Response.json({ ok: true, ...result });
          }

          // Scheduled run: honor agent_settings.
          const { data: settings } = await supabaseAdmin
            .from("agent_settings")
            .select("*")
            .eq("singleton", true)
            .maybeSingle();

          if (!settings || !settings.enabled) {
            return Response.json({ ok: true, skipped: "agent disabled" });
          }

          const result = await runAgentCore({
            supabase: supabaseAdmin,
            triggeredBy: null,
            trigger: "scheduled",
            count: settings.default_count ?? 2,
            focus: settings.default_focus ?? null,
            categoryId: null,
          });
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[agent-run hook]", e);
          return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
        }
      },
    },
  },
});
