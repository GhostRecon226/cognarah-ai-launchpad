import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import slugify from "slugify";
import { stripEmDashes, stripEmDashesInObject } from "./strip-em-dashes";

const ALLOWED_STAGES = ["Idea", "Pre-seed", "Seed", "Series A", "Series B+"];
const ALLOWED_TEAM = ["1-5", "6-15", "16-50", "50+"];
const ALLOWED_REVENUE = ["Pre-revenue", "Early revenue", "Growing revenue"];
const ALLOWED_CONTACT = ["Email", "LinkedIn", "WhatsApp"];
const ALLOWED_TECH = [
  "Large Language Models",
  "Computer Vision",
  "Natural Language Processing",
  "Predictive Analytics",
  "Robotics",
  "Other",
];

export type CofounderInput = { name?: string; role?: string; linkedin?: string };
export type ScreenshotUpload = { base64: string; name: string; type: string };

export type StartupSubmissionInput = {
  company_name: string;
  tagline?: string;
  website_url: string;
  company_linkedin?: string;
  twitter_handle?: string;
  youtube_url?: string;
  country: string;
  city: string;
  year_founded: number;
  company_stage: string;
  product_description: string;
  problem_solved: string;
  mission?: string;
  differentiator?: string;
  competitors?: string;
  business_model?: string;
  pricing_model?: string;
  markets_served?: string;
  target_audience: string;
  ai_technologies: string[];
  founder_name: string;
  founder_linkedin?: string;
  cofounders?: CofounderInput[];
  key_team_members?: string;
  team_size: string;
  user_count?: string;
  revenue_stage: string;
  funding_raised?: string;
  notable_investors?: string;
  partnerships?: string;
  milestones?: string;
  awards?: string;
  product_demo?: string;
  pitch_video_url?: string;
  press_links?: string;
  roadmap?: string;
  founder_email: string;
  contact_method: string;
  whatsapp_number?: string;
  consent: boolean;
  logo_file_base64: string;
  logo_file_name: string;
  logo_file_type: string;
  screenshots?: ScreenshotUpload[];
};

function req(v: unknown, name: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new Error(`${name} is required`);
  return s;
}

function normalizeWebsiteUrl(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) throw new Error("Website URL is required");
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Please enter a valid website URL");
  }
  if (!url.hostname.includes(".") || /\s/.test(url.hostname)) {
    throw new Error("Please enter a valid website URL");
  }
  return url.toString().replace(/\/$/, "");
}


export const submitStartup = createServerFn({ method: "POST" })
  .inputValidator((data: StartupSubmissionInput) => {
    if (!data || typeof data !== "object") throw new Error("Invalid payload");
    if (!data.consent) throw new Error("Consent is required");
    if (!/^\S+@\S+\.\S+$/.test(data.founder_email || "")) throw new Error("Valid founder email required");
    const year = Number(data.year_founded);
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) {
      throw new Error("Valid year founded required");
    }
    if (!ALLOWED_STAGES.includes(data.company_stage)) throw new Error("Invalid company stage");
    if (!ALLOWED_TEAM.includes(data.team_size)) throw new Error("Invalid team size");
    if (!ALLOWED_REVENUE.includes(data.revenue_stage)) throw new Error("Invalid revenue stage");
    if (!ALLOWED_CONTACT.includes(data.contact_method)) throw new Error("Invalid contact method");
    if (data.contact_method === "WhatsApp" && !(data.whatsapp_number || "").trim()) {
      throw new Error("WhatsApp number required");
    }
    const techs = Array.isArray(data.ai_technologies) ? data.ai_technologies.filter((t) => ALLOWED_TECH.includes(t)) : [];
    if (techs.length === 0) throw new Error("Select at least one AI technology");
    if ((data.product_description || "").length > 1500) throw new Error("Product description too long");
    if ((data.problem_solved || "").length > 1500) throw new Error("Problem description too long");
    if ((data.tagline || "").length > 160) throw new Error("Tagline too long");
    if ((data.mission || "").length > 500) throw new Error("Mission statement too long");
    if ((data.differentiator || "").length > 1000) throw new Error("Differentiator too long");
    if ((data.competitors || "").length > 500) throw new Error("Competitors field too long");
    if ((data.business_model || "").length > 500) throw new Error("Business model too long");
    if ((data.pricing_model || "").length > 300) throw new Error("Pricing model too long");
    if ((data.markets_served || "").length > 500) throw new Error("Markets served too long");
    if ((data.key_team_members || "").length > 1000) throw new Error("Key team members too long");
    if ((data.milestones || "").length > 1000) throw new Error("Milestones too long");
    if ((data.awards || "").length > 500) throw new Error("Awards too long");
    if ((data.roadmap || "").length > 800) throw new Error("Roadmap too long");
    if (!data.logo_file_base64 || !data.logo_file_name) throw new Error("Logo is required");
    if (!/^image\//.test(data.logo_file_type || "")) throw new Error("Logo must be an image");

    const cofounders = Array.isArray(data.cofounders)
      ? data.cofounders
          .map((c) => ({
            name: (c?.name || "").trim(),
            role: (c?.role || "").trim(),
            linkedin: (c?.linkedin || "").trim(),
          }))
          .filter((c) => c.name || c.role || c.linkedin)
          .slice(0, 4)
      : [];

    const screenshots = Array.isArray(data.screenshots) ? data.screenshots.slice(0, 3) : [];
    for (const s of screenshots) {
      if (!s?.base64 || !s?.name) throw new Error("Screenshot upload malformed");
      if (!/^image\//.test(s?.type || "")) throw new Error("Screenshots must be images");
    }

    return {
      ...data,
      year_founded: year,
      ai_technologies: techs,
      cofounders,
      screenshots,
      company_name: req(data.company_name, "Company name"),
      website_url: normalizeWebsiteUrl(data.website_url),
      country: req(data.country, "Country"),
      city: req(data.city, "City"),
      product_description: req(data.product_description, "Product description"),
      problem_solved: req(data.problem_solved, "Problem solved"),
      target_audience: req(data.target_audience, "Target audience"),
      founder_name: req(data.founder_name, "Founder name"),
      founder_email: data.founder_email.trim().toLowerCase(),
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Decode base64 logo (allow "data:...;base64,xxx" or raw)
    const b64 = data.logo_file_base64.includes(",")
      ? data.logo_file_base64.split(",").pop()!
      : data.logo_file_base64;
    const bytes = Buffer.from(b64, "base64");
    if (bytes.length > 2 * 1024 * 1024) throw new Error("Logo exceeds 2MB");

    const safeName = data.logo_file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `startup-logos/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("media")
      .upload(path, bytes, { contentType: data.logo_file_type, upsert: false });
    if (upErr) throw new Error(`Logo upload failed: ${upErr.message}`);

    const logo_url = `/api/public/media/${path}`;

    // Upload optional product screenshots (up to 3).
    const screenshot_urls: string[] = [];
    for (const s of data.screenshots ?? []) {
      const sb64 = s.base64.includes(",") ? s.base64.split(",").pop()! : s.base64;
      const sBytes = Buffer.from(sb64, "base64");
      if (sBytes.length > 2 * 1024 * 1024) throw new Error("Screenshot exceeds 2MB");
      const sSafe = s.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const sPath = `startup-screenshots/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sSafe}`;
      const { error: sErr } = await supabaseAdmin.storage
        .from("media")
        .upload(sPath, sBytes, { contentType: s.type, upsert: false });
      if (sErr) throw new Error(`Screenshot upload failed: ${sErr.message}`);
      screenshot_urls.push(`/api/public/media/${sPath}`);
    }

    const markets_served = (data.markets_served || "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
      .slice(0, 20);

    const row = stripEmDashesInObject(
      {
      company_name: data.company_name,
      tagline: data.tagline || null,
      website_url: data.website_url,
      company_linkedin: data.company_linkedin || null,
      twitter_handle: data.twitter_handle || null,
      youtube_url: data.youtube_url || null,
      country: data.country,
      city: data.city,
      year_founded: data.year_founded,
      company_stage: data.company_stage,
      product_description: data.product_description,
      problem_solved: data.problem_solved,
      mission: data.mission || null,
      differentiator: data.differentiator || null,
      competitors: data.competitors || null,
      business_model: data.business_model || null,
      pricing_model: data.pricing_model || null,
      markets_served: markets_served.length > 0 ? markets_served : null,
      target_audience: data.target_audience,
      ai_technologies: data.ai_technologies,
      founder_name: data.founder_name,
      founder_linkedin: data.founder_linkedin || null,
      cofounders: data.cofounders && data.cofounders.length > 0 ? data.cofounders : null,
      key_team_members: data.key_team_members || null,
      team_size: data.team_size,
      user_count: data.user_count || null,
      revenue_stage: data.revenue_stage,
      funding_raised: data.funding_raised || null,
      notable_investors: data.notable_investors || null,
      partnerships: data.partnerships || null,
      milestones: data.milestones || null,
      awards: data.awards || null,
      logo_url,
      screenshot_urls: screenshot_urls.length > 0 ? screenshot_urls : null,
      product_demo: data.product_demo || null,
      pitch_video_url: data.pitch_video_url || null,
      press_links: data.press_links || null,
      roadmap: data.roadmap || null,
      founder_email: data.founder_email,
      contact_method: data.contact_method,
      whatsapp_number: data.contact_method === "WhatsApp" ? data.whatsapp_number || null : null,
      consent: true,
      },
      [
        "company_name",
        "tagline",
        "website_url",
        "country",
        "city",
        "product_description",
        "problem_solved",
        "mission",
        "differentiator",
        "competitors",
        "business_model",
        "pricing_model",
        "target_audience",
        "founder_name",
        "key_team_members",
        "notable_investors",
        "partnerships",
        "milestones",
        "awards",
        "press_links",
        "roadmap",
      ],
    );

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("startup_submissions")
      .insert(row)
      .select("id, submitted_at")
      .single();
    if (insErr) throw new Error(insErr.message);

    // Notify admins (fire-and-forget; never block submission on email failure).
    try {
      const { enqueueTransactionalEmail } = await import("@/lib/email/enqueue-internal.server");
      await enqueueTransactionalEmail({
        templateName: "startup-submission-notification",
        idempotencyKey: `startup-submission-${inserted.id}`,
        templateData: {
          companyName: row.company_name,
          tagline: row.tagline,
          founderName: row.founder_name,
          country: row.country,
          city: row.city,
          companyStage: row.company_stage,
          productDescription: row.product_description,
          problemSolved: row.problem_solved,
          mission: row.mission,
          differentiator: row.differentiator,
          businessModel: row.business_model,
          founderEmail: row.founder_email,
          contactMethod: row.contact_method,
          whatsappNumber: row.whatsapp_number,
          submittedAt: inserted.submitted_at,
          reviewUrl: `https://cognarah.com/admin/startups?submission=${inserted.id}`,
        },
      });
    } catch (err) {
      console.error("Failed to enqueue startup submission notification", err);
    }

    return { ok: true };
  });


// ---------------- Generate startup profile draft ----------------

interface StartupDraft {
  title: string;
  dek: string;
  body_html: string;
  tags: string[];
  seo_title: string;
  meta_description: string;
}

const STARTUP_SYSTEM_PROMPT =
  "You are the AI drafting agent for Cognarah, an African-first AI media publication based in Lagos, Nigeria. Tagline: 'Everything AI. Nothing Else.'\n\n" +
  "VOICE\n" +
  "- Smart, informed journalist. Confident but not arrogant. Clear but not simplistic.\n" +
  "- No hype, no superlatives, no buzzword stacking. Avoid 'groundbreaking', 'revolutionary', 'game-changing'.\n" +
  "- Active voice. Short sentences. One idea per paragraph.\n" +
  "- Never use em dashes anywhere. Use commas, periods, or semicolons instead. If an em dash appears, replace it before returning.\n\n" +
  "TASK: Write a startup profile article using ONLY the submitted facts. Do not invent users, revenue, funding, investors, partnerships, or quotes.\n\n" +
  "COVERAGE RULE (critical): every field supplied in the submission must appear somewhere in the body. Only fields marked 'not provided', 'not disclosed' or 'none provided' may be skipped. Never drop a supplied fact for brevity. Never add a fact that was not supplied.\n\n" +
  "STRUCTURE (every section required, in this order, rendered as clean HTML):\n" +
  "1. Headline: '[Company name] is [one line description of what they do]'. Max 15 words.\n" +
  "2. Opening paragraph: who they are, what they build, where they are based, year founded, stage, mission if provided.\n" +
  "3. <h2>The Problem</h2>: the gap or challenge they are addressing, and who it affects.\n" +
  "4. <h2>The Solution</h2>: how the product works, the AI technology behind it, the business model and pricing model when provided.\n" +
  "5. <h2>The Team</h2>: founder, co-founders, key team members, team size.\n" +
  "6. <h2>Traction</h2>: users or customers, revenue stage, funding raised, notable investors, partnerships, milestones, awards.\n" +
  "7. <h2>Markets and Competition</h2>: markets served, target audience, competitors, and what makes them different.\n" +
  "8. <h2>Roadmap</h2>: what is next, based only on the roadmap supplied. Skip this heading only if no roadmap is provided.\n" +
  "9. <h2>Africa Angle</h2>: if the startup is African (based on country provided), lead with local context and impact. If not African, connect the product or technology to African market opportunities or challenges.\n" +
  "10. Closing line: one forward-looking sentence about what to watch.\n" +
  "11. <h2>Links</h2>: an unordered list of the supplied links only (website, company LinkedIn, Twitter/X, YouTube, product demo, pitch video, press coverage). Omit any that were not provided.\n\n" +
  "SCREENSHOTS: if screenshot URLs are supplied, place EVERY one of them inline in a relevant section, in the order given, as " +
  '<figure><img src="URL" alt="Company name product screenshot" /><figcaption>short factual caption</figcaption></figure>. Use each URL exactly as supplied. Do not skip any, do not repeat any, do not invent image URLs.\n\n' +
  "LENGTH: 700-1100 words.\n\n" +
  "HTML RULES: Use only <p>, <h2>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <figure>, <figcaption>, <img>. No <h1>. End the body with: <p><em>Source:</em> <a href=\"WEBSITE_URL\">Company name</a></p>.\n\n" +
  "OUTPUT: Return ONLY strict JSON, no markdown, no code fences: " +
  '{"title":"...","dek":"...","body_html":"<p>...</p>...","tags":["...","..."],"seo_title":"...","meta_description":"..."}';


const AFRICAN_COUNTRIES = new Set([
  "nigeria","kenya","south africa","ghana","egypt","morocco","tunisia","algeria","ethiopia","uganda","tanzania","rwanda","senegal","ivory coast","cote d'ivoire","cameroon","zambia","zimbabwe","botswana","namibia","angola","mozambique","sudan","somalia","libya","mali","benin","togo","burkina faso","niger","chad","gabon","congo","dr congo","democratic republic of the congo","republic of the congo","sierra leone","liberia","guinea","mauritania","mauritius","madagascar","malawi","eritrea","djibouti","south sudan","lesotho","swaziland","eswatini","cape verde","gambia","central african republic","equatorial guinea","seychelles","comoros","burundi","sao tome and principe",
]);

function buildStartupUserPrompt(s: Record<string, unknown>): string {
  const isAfrican = AFRICAN_COUNTRIES.has(String(s.country || "").trim().toLowerCase());
  const cofounders = Array.isArray(s.cofounders)
    ? (s.cofounders as Array<{ name?: string; role?: string; linkedin?: string }>)
        .map((c) => [c?.name, c?.role, c?.linkedin].filter(Boolean).join(" - "))
        .filter(Boolean)
        .join("; ")
    : "";
  const markets = Array.isArray(s.markets_served) ? (s.markets_served as string[]).join(", ") : "";
  const screenshots = screenshotUrls(s);
  const lines = [
    `Company name: ${s.company_name}`,
    `Tagline: ${s.tagline || "not provided"}`,
    `Website: ${s.website_url}`,
    `Company LinkedIn: ${s.company_linkedin || "not provided"}`,
    `Twitter/X: ${s.twitter_handle || "not provided"}`,
    `YouTube: ${s.youtube_url || "not provided"}`,
    `Headquarters: ${s.city}, ${s.country}${isAfrican ? " (African startup — lead Africa Angle with local context)" : " (non-African startup — connect to African market opportunities)"}`,
    `Markets served: ${markets || "not disclosed"}`,
    `Year founded: ${s.year_founded}`,
    `Company stage: ${s.company_stage}`,
    `Product: ${s.product_description}`,
    `Problem solved: ${s.problem_solved}`,
    `Mission: ${s.mission || "not provided"}`,
    `What makes them different: ${s.differentiator || "not provided"}`,
    `Competitors: ${s.competitors || "not disclosed"}`,
    `Business model: ${s.business_model || "not disclosed"}`,
    `Pricing model: ${s.pricing_model || "not disclosed"}`,
    `Target audience: ${s.target_audience}`,
    `AI technology used: ${Array.isArray(s.ai_technologies) ? (s.ai_technologies as string[]).join(", ") : ""}`,
    `Founder: ${s.founder_name}${s.founder_linkedin ? ` (LinkedIn: ${s.founder_linkedin})` : ""}`,
    `Co-founders: ${cofounders || "not provided"}`,
    `Key team members: ${s.key_team_members || "not provided"}`,
    `Team size: ${s.team_size}`,
    `Users / customers: ${s.user_count || "not disclosed"}`,
    `Revenue stage: ${s.revenue_stage}`,
    `Funding raised: ${s.funding_raised || "not disclosed"}`,
    `Notable investors: ${s.notable_investors || "not disclosed"}`,
    `Partnerships / clients: ${s.partnerships || "not disclosed"}`,
    `Milestones: ${s.milestones || "not provided"}`,
    `Awards / recognition: ${s.awards || "not provided"}`,
    `Roadmap / what's next: ${s.roadmap || "not provided"}`,
    `Product demo: ${s.product_demo || "none provided"}`,
    `Pitch video: ${s.pitch_video_url || "none provided"}`,
    `Press coverage: ${s.press_links || "none provided"}`,
    `Logo image URL (already used as the hero image, do not embed in the body): ${s.logo_url || "none"}`,
    `Screenshot image URLs (embed every one inline, in this order): ${
      screenshots.length > 0 ? screenshots.join(" | ") : "none provided"
    }`,
  ];
  return `Write the startup profile using ONLY these submitted facts:\n\n${lines.join("\n")}\n\nEvery supplied fact above must appear in the body. Embed all ${screenshots.length} screenshot image URLs inline as figures. Return strict JSON per the schema. End the body with the Source footer linking to ${s.website_url}.`;
}



async function geminiDraftStartup(s: Record<string, unknown>): Promise<StartupDraft> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: STARTUP_SYSTEM_PROMPT },
        { role: "user", content: buildStartupUserPrompt(s) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json: any = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as StartupDraft;
}

async function claudeRefineStartup(draft: StartupDraft, websiteUrl: string): Promise<StartupDraft | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: STARTUP_SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content:
            "Refine this startup profile draft for tone, structure, and flow. Do NOT change facts, quotes, links, or the Source footer. " +
            "Do not add users, revenue, funding, investors, or partnerships that are not already present. Keep the same JSON schema. Return ONLY strict JSON, no code fences.\n\n" +
            `Website (must remain in the Source footer): ${websiteUrl}\n\nDRAFT JSON:\n${JSON.stringify(draft)}`,
        }],
      }),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const text: string = Array.isArray(json?.content)
      ? json.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
      : "";
    if (!text) return null;
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as StartupDraft;
    if (!parsed.title || !parsed.body_html) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeDraft(d: StartupDraft): StartupDraft {
  return {
    title: stripEmDashes(d.title || ""),
    dek: stripEmDashes(d.dek || ""),
    body_html: stripEmDashes(d.body_html || ""),
    tags: Array.isArray(d.tags) ? d.tags.map((t) => stripEmDashes(String(t))).slice(0, 8) : [],
    seo_title: stripEmDashes(d.seo_title || ""),
    meta_description: stripEmDashes(d.meta_description || ""),
  };
}

export const generateStartupDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ submission_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    // Verify admin/editor
    const { data: allowed, error: roleErr } = await context.supabase.rpc("has_any_role", {
      _user_id: context.userId,
      _roles: ["admin", "editor"],
    });
    if (roleErr || !allowed) throw new Error("Forbidden");

    const { data: sub, error: subErr } = await context.supabase
      .from("startup_submissions")
      .select("*")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (subErr) throw new Error(subErr.message);
    if (!sub) throw new Error("Submission not found");
    if (sub.status !== "approved") throw new Error("Submission must be approved before generating a draft");
    if (sub.article_id) throw new Error("Draft already generated for this submission");

    // Stage 1: Gemini
    const rough = await geminiDraftStartup(sub);
    // Stage 2: Claude (falls back to Gemini on failure)
    const refined = await claudeRefineStartup(rough, String(sub.website_url));
    const draft = sanitizeDraft(refined ?? rough);

    // Resolve category and AI author
    const [{ data: cats }, { data: authorRow }] = await Promise.all([
      context.supabase.from("categories").select("id,slug").in("slug", ["startups", "funding", "news"]),
      context.supabase.from("authors").select("id").eq("slug", "cognarah-ai").maybeSingle(),
    ]);
    const catBySlug = new Map<string, { id: string }>((cats ?? []).map((c: any) => [c.slug, { id: c.id }]));
    const category = catBySlug.get("startups") ?? catBySlug.get("funding") ?? catBySlug.get("news");

    const slug =
      slugify(`${sub.company_name} ${draft.title}`, { lower: true, strict: true }).slice(0, 110) +
      "-" +
      Date.now().toString(36);

    const { data: inserted, error: insErr } = await context.supabase
      .from("articles")
      .insert({
        title: draft.title.slice(0, 200),
        slug,
        excerpt: draft.dek?.slice(0, 300) ?? null,
        body: draft.body_html,
        hero_image: sub.logo_url,
        author_id: authorRow?.id ?? null,
        author_user_id: context.userId,
        category_id: category?.id ?? null,
        tags: draft.tags,
        seo_title: draft.seo_title?.slice(0, 200) ?? null,
        meta_description: draft.meta_description?.slice(0, 300) ?? null,
        read_time: Math.max(2, Math.round((draft.body_html.length / 1000) * 0.7)),
        status: "draft",
        is_featured: false,
        source_urls: [sub.website_url],
      })
      .select("id,slug")
      .single();
    if (insErr) throw new Error(`Draft insert failed: ${insErr.message}`);

    // Update submission
    const { error: updErr } = await context.supabase
      .from("startup_submissions")
      .update({ status: "published", article_id: inserted.id })
      .eq("id", data.submission_id);
    if (updErr) throw new Error(updErr.message);

    return { article_id: inserted.id as string, slug: inserted.slug as string, refined: !!refined };
  });

