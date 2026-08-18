import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/skills-files/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!path || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }
        const url = new URL(request.url);
        const forceDownload = url.searchParams.get("download") === "1";
        const filename = path.split("/").pop() || "skill-file";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Only serve files that belong to a published skill. Draft skill files
        // must not be downloadable by anyone who learns or guesses the path.
        const { data: skill } = await supabaseAdmin
          .from("skills")
          .select("id")
          .eq("published", true)
          .eq("file_url", `/api/public/skills-files/${path}`)
          .maybeSingle();
        if (!skill) {
          return new Response("Not found", { status: 404 });
        }

        const { data, error } = await supabaseAdmin.storage
          .from("skills-files")
          .createSignedUrl(path, 3600, forceDownload ? { download: filename } : undefined);

        if (error || !data?.signedUrl) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(null, {
          status: 302,
          headers: {
            Location: data.signedUrl,
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
