import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint. Auth is via Supabase anon `apikey` header (pg_cron canonical pattern).
// Route runs the scheduled agent using the service-role client.
export const Route = createFileRoute("/api/public/hooks/agent-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: settings } = await supabaseAdmin
            .from("agent_settings")
            .select("*")
            .eq("singleton", true)
            .maybeSingle();

          if (!settings || !settings.enabled) {
            return Response.json({ ok: true, skipped: "agent disabled" });
          }

          const { runAgentCore } = await import("@/lib/agent-core.server");
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
          console.error("[agent-run cron]", e);
          return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
        }
      },
    },
  },
});
