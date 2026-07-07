import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function NewsletterSignup({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const dark = variant === "dark";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.from("newsletter_subscribers").insert({ email });
    setLoading(false);
    if (error) {
      if (error.code === "23505") toast.success("You're already subscribed.");
      else toast.error("Could not subscribe. Try again.");
      return;
    }
    setEmail("");
    toast.success("Subscribed. Welcome to Cognarah.");
  }

  return (
    <section className={dark ? "bg-navy text-navy-foreground" : "bg-secondary"}>
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <p className={`text-xs font-semibold uppercase tracking-widest ${dark ? "text-brand" : "text-brand"}`}>
          Newsletter
        </p>
        <h2 className={`mt-3 text-3xl font-bold tracking-tight sm:text-4xl ${dark ? "text-white" : "text-foreground"}`}>
          The AI brief, in your inbox.
        </h2>
        <p className={`mt-3 text-base ${dark ? "text-white/70" : "text-muted-foreground"}`}>
          One curated email. Everything that matters in AI. Nothing else.
        </p>
        <form onSubmit={submit} className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
          <label htmlFor="newsletter-email" className="sr-only">Email address</label>
          <input
            id="newsletter-email"
            type="email"
            required
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            className={`flex-1 rounded-md border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand ${
              dark
                ? "border-white/20 bg-white/5 text-white placeholder:text-white/40"
                : "border-border bg-background text-foreground placeholder:text-muted-foreground"
            }`}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition hover:bg-brand/90 disabled:opacity-60"
          >
            {loading ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
      </div>
    </section>
  );
}
