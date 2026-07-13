// Server-only: fetch and parse skill packages (single SKILL.md or a bundle).
// Handles GitHub folders, raw SKILL.md files, and .zip archives.
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  license?: string;
  author?: string;
  category?: string;
  difficulty?: string;
  [k: string]: unknown;
}

export interface ParsedSkillPackage {
  skillMd: string;              // raw SKILL.md contents (with frontmatter)
  frontmatter: SkillFrontmatter;
  body: string;                 // SKILL.md content without frontmatter
  files: Array<{ path: string; bytes: Uint8Array }>; // all files (incl. SKILL.md)
  licenseText: string | null;   // LICENSE* file contents
  isBundle: boolean;
  format: "single-skill-md" | "zip" | "github-folder" | "scraped-fallback";
}

// -------- Frontmatter parsing (dependency-free, minimal YAML subset) --------
const FRONTMATTER_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/;

export function parseFrontmatter(md: string): { frontmatter: SkillFrontmatter; body: string } {
  const match = md.match(FRONTMATTER_RE);
  if (!match) return { frontmatter: {}, body: md };
  const yaml = match[1];
  const body = md.slice(match[0].length);
  const fm: SkillFrontmatter = {};
  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    // strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) fm[key] = value;
  }
  return { frontmatter: fm, body };
}

// -------- License helpers --------
const LICENSE_FILE_RE = /^(LICENSE|LICENCE|COPYING)(\.(txt|md))?$/i;

function findLicense(files: Array<{ path: string; bytes: Uint8Array }>): string | null {
  for (const f of files) {
    const base = f.path.split("/").pop() ?? "";
    if (LICENSE_FILE_RE.test(base)) {
      try { return strFromU8(f.bytes); } catch { return null; }
    }
  }
  return null;
}

function findSkillMd(files: Array<{ path: string; bytes: Uint8Array }>): { path: string; text: string } | null {
  for (const f of files) {
    const base = f.path.split("/").pop() ?? "";
    if (base.toLowerCase() === "skill.md") {
      try { return { path: f.path, text: strFromU8(f.bytes) }; } catch { return null; }
    }
  }
  return null;
}

// -------- Restrictive-license heuristic --------
export function assessLicense(text: string | null): { ok: boolean; reason: string } {
  if (!text || text.trim().toLowerCase() === "unspecified") {
    return { ok: false, reason: "license unspecified" };
  }
  const lc = text.toLowerCase();
  const restrictive = /\bnoncommercial\b|\bnon-commercial\b|\bno\s+redistribution\b|\bproprietary\b|\ball\s+rights\s+reserved\b/;
  const permissive = /\bmit\b|\bapache(\s+2)?\b|\bbsd\b|\bcc0\b|\bcc[- ]by\b|\bunlicense\b|\bmpl\b|\bisc\b/;
  const isPermissive = permissive.test(lc);
  const isRestrictive = restrictive.test(lc);
  if (isPermissive && !isRestrictive) return { ok: true, reason: "permissive license detected" };
  if (isRestrictive) return { ok: false, reason: "restrictive license terms detected" };
  return { ok: false, reason: "license terms unclear (no permissive marker found)" };
}

// -------- URL classifier + fetchers --------
type UrlKind =
  | { kind: "raw-skill-md"; url: string }
  | { kind: "zip"; url: string }
  | { kind: "github-folder"; owner: string; repo: string; path: string; ref: string }
  | { kind: "generic" };

function classifyUrl(rawUrl: string): UrlKind {
  const url = rawUrl.trim();
  const lower = url.toLowerCase();
  if (lower.endsWith(".zip")) return { kind: "zip", url };
  if (lower.endsWith("/skill.md") || lower.endsWith("skill.md")) return { kind: "raw-skill-md", url };
  // GitHub tree/blob folder pattern: https://github.com/<owner>/<repo>/tree/<ref>/<path>
  const gh = url.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/?(.*)$/i);
  if (gh) {
    return { kind: "github-folder", owner: gh[1], repo: gh[2], ref: gh[3], path: gh[4] || "" };
  }
  return { kind: "generic" };
}

async function fetchGithubFolder(owner: string, repo: string, ref: string, path: string): Promise<Array<{ path: string; bytes: Uint8Array }>> {
  // Recursively fetch every file under path via GitHub contents API.
  const files: Array<{ path: string; bytes: Uint8Array }> = [];
  const headers: Record<string, string> = { "User-Agent": "cognarah-skills-agent" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  async function walk(p: string) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${p}?ref=${encodeURIComponent(ref)}`;
    const res = await fetch(apiUrl, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status} for ${apiUrl}`);
    const json: any = await res.json();
    const entries = Array.isArray(json) ? json : [json];
    for (const entry of entries) {
      if (entry.type === "dir") {
        await walk(entry.path);
      } else if (entry.type === "file" && entry.download_url) {
        const dl = await fetch(entry.download_url, { headers });
        if (!dl.ok) continue;
        const buf = new Uint8Array(await dl.arrayBuffer());
        // Store with path relative to the root folder
        const relPath = entry.path.startsWith(path + "/") ? entry.path.slice(path.length + 1) : entry.path;
        files.push({ path: relPath, bytes: buf });
      }
    }
  }
  await walk(path);
  return files;
}

async function fetchZip(url: string): Promise<Array<{ path: string; bytes: Uint8Array }>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Zip fetch ${res.status}: ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const unzipped = unzipSync(buf);
  const files: Array<{ path: string; bytes: Uint8Array }> = [];
  for (const [p, bytes] of Object.entries(unzipped)) {
    if (p.endsWith("/")) continue; // directory entry
    files.push({ path: p, bytes });
  }
  return files;
}

async function fetchRawSkillMd(url: string): Promise<Uint8Array> {
  // Normalize github.com/.../blob/... to raw.githubusercontent.com
  let target = url;
  const blob = url.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/(.+)$/i);
  if (blob) target = `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}`;
  const res = await fetch(target);
  if (!res.ok) throw new Error(`Fetch ${res.status}: ${target}`);
  return new Uint8Array(await res.arrayBuffer());
}

// -------- Main entry point --------
export async function fetchSkillPackage(url: string): Promise<ParsedSkillPackage | null> {
  const cls = classifyUrl(url);

  if (cls.kind === "raw-skill-md") {
    const bytes = await fetchRawSkillMd(cls.url);
    const text = strFromU8(bytes);
    const { frontmatter, body } = parseFrontmatter(text);
    return {
      skillMd: text,
      frontmatter,
      body,
      files: [{ path: "SKILL.md", bytes }],
      licenseText: typeof frontmatter.license === "string" ? frontmatter.license : null,
      isBundle: false,
      format: "single-skill-md",
    };
  }

  if (cls.kind === "zip") {
    const files = await fetchZip(cls.url);
    const skillMd = findSkillMd(files);
    if (!skillMd) return null;
    const { frontmatter, body } = parseFrontmatter(skillMd.text);
    const licenseText = findLicense(files) ?? (typeof frontmatter.license === "string" ? frontmatter.license : null);
    return {
      skillMd: skillMd.text,
      frontmatter,
      body,
      files,
      licenseText,
      isBundle: files.length > 1,
      format: "zip",
    };
  }

  if (cls.kind === "github-folder") {
    const files = await fetchGithubFolder(cls.owner, cls.repo, cls.ref, cls.path);
    if (files.length === 0) return null;
    const skillMd = findSkillMd(files);
    if (!skillMd) return null;
    const { frontmatter, body } = parseFrontmatter(skillMd.text);
    const licenseText = findLicense(files) ?? (typeof frontmatter.license === "string" ? frontmatter.license : null);
    return {
      skillMd: skillMd.text,
      frontmatter,
      body,
      files,
      licenseText,
      isBundle: files.length > 1,
      format: "github-folder",
    };
  }

  // Generic: caller should fall back to Firecrawl scrape.
  return null;
}

// -------- Package to zip for storage --------
export function buildZip(files: Array<{ path: string; bytes: Uint8Array }>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.path] = f.bytes;
  return zipSync(entries, { level: 6 });
}

export { strToU8, strFromU8 };
