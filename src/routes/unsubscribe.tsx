import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({
    meta: [
      { title: "Unsubscribe from Cognarah emails" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnsubscribePage,
});

type State =
  | { kind: "loading" }
  | { kind: "valid" }
  | { kind: "invalid" }
  | { kind: "already" }
  | { kind: "confirming" }
  | { kind: "success" }
  | { kind: "error"; message: string };

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setState({ kind: "invalid" });
      return;
    }
    setToken(t);
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          setState({ kind: "invalid" });
          return;
        }
        if (body?.valid === false && body?.reason === "already_unsubscribed") {
          setState({ kind: "already" });
          return;
        }
        if (body?.valid) setState({ kind: "valid" });
        else setState({ kind: "invalid" });
      })
      .catch(() => setState({ kind: "invalid" }));
  }, []);

  async function confirm() {
    if (!token) return;
    setState({ kind: "confirming" });
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body?.success) setState({ kind: "success" });
      else if (body?.reason === "already_unsubscribed") setState({ kind: "already" });
      else setState({ kind: "error", message: body?.error || "Something went wrong" });
    } catch {
      setState({ kind: "error", message: "Network error" });
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Cognarah email preferences</h1>

        {state.kind === "loading" && (
          <p className="mt-4 text-sm text-muted-foreground">Checking your link, one moment.</p>
        )}

        {state.kind === "invalid" && (
          <p className="mt-4 text-sm text-muted-foreground">
            This unsubscribe link is invalid or has expired.
          </p>
        )}

        {state.kind === "already" && (
          <p className="mt-4 text-sm text-muted-foreground">
            You are already unsubscribed. You will not receive further emails.
          </p>
        )}

        {state.kind === "valid" && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              Click below to unsubscribe from Cognarah emails.
            </p>
            <button
              onClick={confirm}
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Confirm unsubscribe
            </button>
          </>
        )}

        {state.kind === "confirming" && (
          <p className="mt-4 text-sm text-muted-foreground">Processing your request.</p>
        )}

        {state.kind === "success" && (
          <p className="mt-4 text-sm text-foreground">
            You have been unsubscribed. Thank you for letting us know.
          </p>
        )}

        {state.kind === "error" && (
          <p className="mt-4 text-sm text-destructive">{state.message}</p>
        )}
      </div>
    </div>
  );
}
