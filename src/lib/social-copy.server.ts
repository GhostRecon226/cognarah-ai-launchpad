// Server-only: social copy generation for the promotion queue.
import { stripEmDashes } from "./strip-em-dashes";

export type Channel = "linkedin" | "x" | "whatsapp" | "newsletter";
export type Voice = "cognarah" | "founder";

const VOICE_RULES: Record<Voice, string> = {
  cognarah:
    "Write as the Cognarah publication account. Confident, editorial, African-first, analytical. Use 'we' sparingly. No hype, no emoji spam, no marketing cliches.",
  founder:
    "Write as the Cognarah founder posting personally. First person, direct, opinionated, human. Share the reason this story matters to you as someone building AI media from Lagos. Still factual.",
};

const CHANNEL_RULES: Record<Channel, string> = {
  linkedin:
    "Format for LinkedIn. Structure it as: a one line hook that stops the scroll, a blank line, two to four short takeaway lines (each a full sentence, no numbering symbols beyond a simple dash), a blank line, one question to the reader, a blank line, then the line 'Read the full piece: LINK'. Keep the whole post between 120 and 220 words. Add 3 to 5 relevant hashtags on the final line.",
  x:
    "Format for X. Under 270 characters total including the link. One sharp hook, one concrete fact, then the link. No hashtags beyond one, if any.",
  whatsapp:
    "Format for a WhatsApp broadcast or group. Short paragraphs, plain text, no hashtags. Open with the news in one line, add two quick bullets using a dash, close with the link.",
  newsletter:
    "Format as a newsletter blurb. One bold-free intro line, then two to three sentences of context and why it matters, then the link on its own line. Between 70 and 120 words.",
};

const BASE_RULES =
  "You write promotional copy for Cognarah, an African-first AI media publication based in Lagos, Nigeria. Tagline: 'Everything AI. Nothing Else.'\n" +
  "Hard rules:\n" +
  "- Never invent facts, numbers, quotes or claims. Use only what the article contains.\n" +
  "- Never use em dashes. Use commas, periods or semicolons instead.\n" +
  "- No clickbait, no 'game changer', no 'revolutionary', no 'in today's fast paced world'.\n" +
  "- Do not promise anything the article does not deliver.\n" +
  "- Return plain text only. No markdown headings, no code fences, no commentary about the task.";

export interface CopyArticle {
  title: string;
  excerpt: string | null;
  body: string;
  key_takeaways: string[] | null;
  tags: string[] | null;
  category: string | null;
  africa_relevance_score: number | null;
}

function plainText(html: string, max = 4000): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Generate promotion copy with Claude. Throws with a readable message on failure. */
export async function generateSocialCopy(args: {
  article: CopyArticle;
  channel: Channel;
  voice: Voice;
  link: string;
  extraNote?: string | null;
}): Promise<string> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");

  const a = args.article;
  const prompt =
    `${VOICE_RULES[args.voice]}\n\n${CHANNEL_RULES[args.channel]}\n\n` +
    `Use this exact link wherever a link is required: ${args.link}\n\n` +
    (args.extraNote ? `Editor note to follow: ${args.extraNote}\n\n` : "") +
    `ARTICLE\nHeadline: ${a.title}\n` +
    `Category: ${a.category ?? "n/a"}\n` +
    (a.excerpt ? `Standfirst: ${a.excerpt}\n` : "") +
    ((a.key_takeaways ?? []).length ? `Key takeaways: ${(a.key_takeaways ?? []).join(" | ")}\n` : "") +
    ((a.tags ?? []).length ? `Tags: ${(a.tags ?? []).join(", ")}\n` : "") +
    (a.africa_relevance_score != null ? `African relevance score: ${a.africa_relevance_score}/5. Only lead with the African angle if this is 3 or higher.\n` : "") +
    `\nBody:\n${plainText(a.body)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: BASE_RULES,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Copy generation failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const text: string = Array.isArray(json?.content)
    ? json.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
    : "";
  if (!text.trim()) throw new Error("Copy generation returned an empty response");
  return stripEmDashes(text.trim());
}
