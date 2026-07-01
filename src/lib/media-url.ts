// Rewrites stored media references to a stable app-served signed-redirect path.
// Keeps the private "media" bucket private and lets URLs never expire.

const LEGACY_RE = /\/storage\/v1\/object\/(?:public|sign)\/media\/([^?#]+)/;

export function mediaUrl(input?: string | null, base?: string): string {
  if (!input) return "";
  let path: string | null = null;
  if (input.startsWith("/api/public/media/")) {
    path = input.slice("/api/public/media/".length);
  } else {
    const m = input.match(LEGACY_RE);
    if (m) path = m[1];
  }
  if (path) {
    const rel = `/api/public/media/${path}`;
    return base ? `${base.replace(/\/$/, "")}${rel}` : rel;
  }
  return input;
}
