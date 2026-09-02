import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoMark from "@/assets/cognarah-logo-mark.png";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reset password: Cognarah" }, { name: "robots", content: "noindex" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user lands here from the email link.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Also handle the case where the session is already set (link already processed).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={logoMark} alt="Cognarah" className="h-8" />
        </div>
        <h1 className="text-2xl font-bold">Set a new password</h1>

        {done ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              Your password was updated.
            </div>
            <Link to="/auth" className="inline-block w-full rounded-md bg-navy px-4 py-2.5 text-center font-semibold text-white hover:bg-navy/90">
              Go to sign in
            </Link>
          </div>
        ) : !ready ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Waiting for the recovery link… Open this page from the password-reset email you received. If you came here by accident, <Link to="/auth" className="text-brand hover:underline">return to sign in</Link>.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">New password</label>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="text-sm font-medium">Confirm new password</label>
              <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <button disabled={loading} type="submit" className="w-full rounded-md bg-navy px-4 py-2.5 font-semibold text-white transition hover:bg-navy/90 disabled:opacity-60">
              {loading ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
