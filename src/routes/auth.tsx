import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { hasAnyAdmin } from "@/lib/setup.functions";
import { toast } from "sonner";
import logoAsset from "@/assets/cognarah-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/admin" });
  },
  head: () => ({ meta: [{ title: "Sign in — Cognarah" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const check = useServerFn(hasAnyAdmin);

  useEffect(() => {
    check().then((r) => setNeedsSetup(!r.hasAdmin)).catch(() => {});
  }, [check]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/admin" },
      });
      if (error) toast.error(error.message);
      else {
        toast.success("Account created. You can sign in now.");
        setMode("signin");
      }
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) toast.error(error.message);
      else toast.success("If that email exists, a reset link is on its way.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else window.location.href = "/admin";
    }
    setLoading(false);
  }

  const title =
    mode === "signin" ? "Sign in to CMS" : mode === "signup" ? "Create CMS account" : "Reset your password";

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={logoAsset.url} alt="Cognarah" className="h-8" />
        </div>

        {needsSetup && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            No administrator has been configured yet.{" "}
            <Link to="/setup" className="font-semibold underline">Run first-time setup →</Link>
          </div>
        )}

        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cognarah editorial backend.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-brand" />
          </div>
          {mode !== "forgot" && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Password</label>
                {mode === "signin" && (
                  <button type="button" onClick={() => setMode("forgot")} className="text-xs text-brand hover:underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-brand" />
            </div>
          )}
          <button disabled={loading} type="submit" className="w-full rounded-md bg-navy px-4 py-2.5 font-semibold text-white transition hover:bg-navy/90 disabled:opacity-60">
            {loading ? "…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2 text-sm">
          {mode !== "signin" && (
            <button onClick={() => setMode("signin")} className="text-left text-brand hover:underline">
              ← Back to sign in
            </button>
          )}
          {mode === "signin" && (
            <button onClick={() => setMode("signup")} className="text-left text-brand hover:underline">
              Need an account? Sign up
            </button>
          )}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Note: CMS admin access is restricted. New sign-ups have no roles until an administrator grants access.
        </p>
      </div>
    </div>
  );
}
