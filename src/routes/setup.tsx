import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { hasAnyAdmin, claimInitialAdmin } from "@/lib/setup.functions";
import { toast } from "sonner";
import logoMark from "@/assets/cognarah-logo-mark.png";

export const Route = createFileRoute("/setup")({
  ssr: false,
  loader: async () => {
    const { hasAdmin } = await hasAnyAdmin();
    if (hasAdmin) throw redirect({ to: "/auth" });
    return null;
  },
  head: () => ({ meta: [{ title: "First-time setup: Cognarah" }, { name: "robots", content: "noindex" }] }),
  component: SetupPage,
});

function SetupPage() {
  const claim = useServerFn(claimInitialAdmin);
  const check = useServerFn(hasAnyAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Re-check on mount in case admin was just created elsewhere.
  useEffect(() => {
    check().then((r) => {
      if (r.hasAdmin) window.location.href = "/auth";
    });
  }, [check]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await claim({ data: { email, password } });
      toast.success("Admin account created. You can sign in now.");
      setDone(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={logoMark} alt="Cognarah" className="h-8" />
        </div>
        <h1 className="text-2xl font-bold">First-time setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create the initial administrator for the Cognarah CMS. This page is available only until an admin exists.
        </p>

        {done ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              Admin account created for <strong>{email}</strong>.
            </div>
            <Link to="/auth" className="inline-block w-full rounded-md bg-navy px-4 py-2.5 text-center font-semibold text-white hover:bg-navy/90">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Admin email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-brand" />
              <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Confirm password</label>
              <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <button disabled={loading} type="submit" className="w-full rounded-md bg-navy px-4 py-2.5 font-semibold text-white transition hover:bg-navy/90 disabled:opacity-60">
              {loading ? "Creating…" : "Create admin account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
