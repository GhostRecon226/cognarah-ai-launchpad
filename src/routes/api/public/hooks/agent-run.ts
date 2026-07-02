import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint. Auth is via Supabase anon `apikey` header (pg_cron canonical pattern).
// Route runs the scheduled agent using the service-role client.
export const Route = createFileRoute("/api/public/hooks/agent-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authenticate with a dedicated server-only shared secret.
        // Accept either `Authorization: Bearer <secret>` or `x-agent-cron-secret` header.
        const expected = process.env.AGENT_CRON_SECRET;
        const authHeader = request.headers.get("authorization") ?? "";
        const bearer = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
        const provided = bearer || request.headers.get("x-agent-cron-secret") || "";
        if (!expected || !provided || provided !== expected) {
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
