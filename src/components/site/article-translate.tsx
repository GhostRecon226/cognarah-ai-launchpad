import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Loader2, Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { translateArticle, type TranslationResult } from "@/lib/translate.functions";
import { ALL_LANGUAGES, COMMON_LANGUAGES, languageName } from "@/lib/languages";

const DISMISS_KEY = "cognarah:lang-prompt-dismissed";

interface Props {
  slug: string;
  active: TranslationResult | null;
  onTranslated: (result: TranslationResult | null) => void;
}

export function ArticleTranslate({ slug, active, onTranslated }: Props) {
  const run = useServerFn(translateArticle);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    const raw = (navigator.language || "").toLowerCase();
    const base = raw.split("-")[0];
    if (!base || base === "en") return;
    setSuggested(base);
  }, []);

  const dismissPrompt = () => {
    setSuggested(null);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable, prompt simply reappears next visit */
    }
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.code === q,
    ).slice(0, 8);
  }, [query]);

  async function translate(code: string) {
    const id = ++requestId.current;
    setPending(code);
    setOpen(false);
    try {
      const result = await run({ data: { slug, languageCode: code } });
      if (requestId.current !== id) return;
      onTranslated(result);
    } catch (e) {
      if (requestId.current !== id) return;
      toast.error(e instanceof Error ? e.message : "Translation failed. Please try again.");
    } finally {
      if (requestId.current === id) setPending(null);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            aria-label="Translate this article"
            disabled={pending !== null}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            <span>
              {pending
                ? `Translating into ${languageName(pending)}`
                : active
                  ? languageName(active.languageCode)
                  : "Translate"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Read in another language
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {COMMON_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => translate(l.code)}
                className="rounded-full border border-border px-3 py-1 text-sm hover:border-brand hover:text-brand"
              >
                {l.name}
              </button>
            ))}
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any other language"
            className="mt-3"
          />
          {results.length > 0 && (
            <ul className="mt-2 max-h-52 overflow-y-auto">
              {results.map((l) => (
                <li key={l.code}>
                  <button
                    type="button"
                    onClick={() => translate(l.code)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
                  >
                    <span>{l.name}</span>
                    {active?.languageCode === l.code && <Check className="h-4 w-4 text-brand" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && results.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">No language matched that search.</p>
          )}
        </PopoverContent>
      </Popover>

      {active && (
        <button
          type="button"
          onClick={() => {
            requestId.current += 1;
            setPending(null);
            onTranslated(null);
          }}
          className="text-sm font-medium text-brand underline underline-offset-4"
        >
          Read in original language
        </button>
      )}

      {pending && (
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          This can take a few seconds the first time.
        </span>
      )}

      {suggested && !active && !pending && (
        <div className="flex w-full items-center gap-3 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm">
          <span>Read this in {languageName(suggested)}?</span>
          <Button size="sm" variant="secondary" onClick={() => { const c = suggested; dismissPrompt(); translate(c); }}>
            Yes
          </Button>
          <button
            type="button"
            onClick={dismissPrompt}
            aria-label="Dismiss translation prompt"
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
