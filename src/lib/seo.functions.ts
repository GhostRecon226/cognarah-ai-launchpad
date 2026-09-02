import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Called directly from the admin article publish/update flow
// (src/routes/_authenticated/admin/articles.$id.tsx) so Google is notified
// the moment content actually changes, rather than on a schedule. Reuses the
// admin session's own auth instead of the cron secret, since this is a
// same-request browser call, not an external/scheduled trigger (that path
// stays available at src/routes/api/public/hooks/resubmit-sitemap.ts).
export const resubmitSitemap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: roleErr } = await context.supabase.rpc("has_any_role", {
      _user_id: context.userId,
      _roles: ["admin", "editor"],
    });
    if (roleErr || !allowed) throw new Error("Forbidden");

    // Dynamic import: this is a .functions.ts file that ships to the client bundle, so
    // server-only modules must be loaded inside the handler, not imported at the top level.
    const { pingGoogleSitemap } = await import("./sitemap.server");
    return pingGoogleSitemap();
  });
