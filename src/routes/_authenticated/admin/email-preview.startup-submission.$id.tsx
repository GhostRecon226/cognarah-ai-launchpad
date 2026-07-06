import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { previewStartupSubmissionEmail } from "@/lib/email-preview.functions";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute(
  "/_authenticated/admin/email-preview/startup-submission/$id",
)({
  head: () => ({
    meta: [
      { title: "Preview: startup submission email: Cognarah CMS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PreviewPage,
});

function PreviewPage() {
  const { id } = Route.useParams();
  const preview = useServerFn(previewStartupSubmissionEmail);

  const { data, isLoading, error } = useQuery({
    queryKey: ["email-preview", "startup-submission", id],
    queryFn: () => preview({ data: { id } }),
    staleTime: 0,
  });

  return (
    <AdminShell title="Preview: startup submission email" requiredRoles={["admin", "editor"]}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to="/admin/startups"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to submissions
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Rendering email...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error instanceof Error ? error.message : "Failed to render preview"}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-background p-4 text-sm">
            <dl className="grid grid-cols-[110px,1fr] gap-x-4 gap-y-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To</dt>
              <dd className="text-foreground">{data.to}</dd>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</dt>
              <dd className="font-medium text-foreground">{data.subject}</dd>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company</dt>
              <dd className="text-foreground">{data.companyName}</dd>
            </dl>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-white">
            <div className="border-b border-border bg-secondary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              HTML preview
            </div>
            <iframe
              title="Email HTML preview"
              srcDoc={data.html}
              sandbox=""
              className="h-[800px] w-full bg-white"
            />
          </div>

          <details className="rounded-lg border border-border bg-background">
            <summary className="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plain-text version
            </summary>
            <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap px-4 py-3 text-xs text-foreground">
              {data.text}
            </pre>
          </details>
        </div>
      )}
    </AdminShell>
  );
}
