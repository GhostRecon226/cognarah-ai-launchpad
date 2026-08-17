import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "cognarah-install-dismissed-until";
const VIEW_KEY = "cognarah-article-views";
const DISMISS_DAYS = 7;
const VIEW_THRESHOLD = 2;
const TIME_THRESHOLD_MS = 60_000;

function isDismissed(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function articleViews(): number {
  try {
    return Number(localStorage.getItem(VIEW_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

/** Call once per article page view so the install prompt can gauge engagement. */
export function recordArticleView() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VIEW_KEY, String(articleViews() + 1));
  } catch {
    /* storage unavailable */
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [eligible, setEligible] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (isDismissed()) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (articleViews() >= VIEW_THRESHOLD) {
      setEligible(true);
      return;
    }
    const timer = window.setTimeout(() => setEligible(true), TIME_THRESHOLD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (eligible && deferred) setVisible(true);
  }, [eligible, deferred]);

  if (!visible || !deferred) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    } catch {
      /* storage unavailable */
    }
    setVisible(false);
  };

  const install = async () => {
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* prompt already consumed */
    }
    setDeferred(null);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-4 sm:w-96">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
        <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand/20 text-brand">
          <Download className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install Cognarah for quick access to AI news</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={install}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
