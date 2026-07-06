import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Download, Mail, Search } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/subscribers")({
  head: () => ({ meta: [{ title: "Subscribers: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: Subscribers,
});

type Subscriber = { id: string; email: string; created_at: string };

function Subscribers() {
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("id, email, created_at")
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      else setRows((data ?? []) as Subscriber[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(term));
  }, [rows, q]);

  const exportCsv = () => {
    const header = "email,subscribed_at\n";
    const body = filtered
      .map((r) => `"${r.email.replace(/"/g, '""')}",${r.created_at}`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell title="Subscribers" requiredRoles={["admin"]}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-brand/15 p-2 text-brand"><Mail className="h-5 w-5" /></div>
          <div>
            <div className="text-sm text-muted-foreground">Total subscribers</div>
            <div className="text-2xl font-bold">{rows.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email"
              className="h-9 w-64 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-brand"
            />
          </div>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-navy px-3 text-sm font-medium text-white hover:bg-navy/90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Subscribed on</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">Loading...</td></tr>
            )}
            {!loading && error && (
              <tr><td colSpan={2} className="px-4 py-6 text-center text-destructive">{error}</td></tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                {rows.length === 0 ? "No subscribers yet." : "No matches."}
              </td></tr>
            )}
            {!loading && !error && filtered.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5">{r.email}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{format(new Date(r.created_at), "PP p")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
