import { Twitter, Linkedin, Facebook, MessageCircle } from "lucide-react";

export function ArticleShare({
  url,
  title,
  compact,
}: {
  url: string;
  title: string;
  compact?: boolean;
}) {
  const enc = encodeURIComponent;
  const shareTitle = enc(title);

  const platforms = [
    {
      name: "X",
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${shareTitle}`,
      Icon: Twitter,
    },
    {
      name: "LinkedIn",
      label: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
      Icon: Linkedin,
    },
    {
      name: "Facebook",
      label: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      Icon: Facebook,
    },
    {
      name: "WhatsApp",
      label: "Share on WhatsApp",
      href: `https://wa.me/?text=${shareTitle}%20${enc(url)}`,
      Icon: MessageCircle,
    },
  ];

  if (compact) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">Share:</span>
        {platforms.map(({ label, href, Icon }) => (
          <a
            key={label}
            aria-label={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-secondary p-1.5 text-muted-foreground transition hover:bg-navy hover:text-white"
          >
            <Icon className="h-3 w-3" />
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-12 flex items-center gap-3 border-t border-white/10 pt-6">
      <span className="text-sm font-semibold text-foreground">Share:</span>
      {platforms.map(({ label, href, Icon }) => (
        <a
          key={label}
          aria-label={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full bg-secondary p-2 text-muted-foreground transition hover:bg-navy hover:text-white"
        >
          <Icon className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}
