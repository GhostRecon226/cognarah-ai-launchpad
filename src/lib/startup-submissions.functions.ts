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

export type StartupSubmissionInput = {
  company_name: string;
  website_url: string;
  country: string;
  city: string;
  year_founded: number;
  company_stage: string;
  product_description: string;
  problem_solved: string;
  target_audience: string;
  ai_technologies: string[];
  founder_name: string;
  founder_linkedin?: string;
  team_size: string;
  user_count?: string;
  revenue_stage: string;
  funding_raised?: string;
  notable_investors?: string;
  partnerships?: string;
  product_demo?: string;
  press_links?: string;
  founder_email: string;
  contact_method: string;
  whatsapp_number?: string;
  consent: boolean;
  logo_file_base64: string;
  logo_file_name: string;
  logo_file_type: string;
};

function req(v: unknown, name: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new Error(`${name} is required`);
  return s;
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
    if ((data.product_description || "").length > 300) throw new Error("Product description too long");
    if ((data.problem_solved || "").length > 300) throw new Error("Problem description too long");
    if (!data.logo_file_base64 || !data.logo_file_name) throw new Error("Logo is required");
    if (!/^image\//.test(data.logo_file_type || "")) throw new Error("Logo must be an image");

    return {
      ...data,
      year_founded: year,
      ai_technologies: techs,
      company_name: req(data.company_name, "Company name"),
      website_url: req(data.website_url, "Website URL"),
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

    const row = stripEmDashesInObject(
      {
      company_name: data.company_name,
      website_url: data.website_url,
      country: data.country,
      city: data.city,
      year_founded: data.year_founded,
      company_stage: data.company_stage,
      product_description: data.product_description,
      problem_solved: data.problem_solved,
      target_audience: data.target_audience,
      ai_technologies: data.ai_technologies,
      founder_name: data.founder_name,
      founder_linkedin: data.founder_linkedin || null,
      team_size: data.team_size,
      user_count: data.user_count || null,
      revenue_stage: data.revenue_stage,
      funding_raised: data.funding_raised || null,
      notable_investors: data.notable_investors || null,
      partnerships: data.partnerships || null,
      logo_url,
      product_demo: data.product_demo || null,
      press_links: data.press_links || null,
      founder_email: data.founder_email,
      contact_method: data.contact_method,
      whatsapp_number: data.contact_method === "WhatsApp" ? data.whatsapp_number || null : null,
      consent: true,
      },
      [
        "company_name",
        "website_url",
        "country",
        "city",
        "product_description",
        "problem_solved",
        "target_audience",
        "founder_name",
        "notable_investors",
        "partnerships",
        "press_links",
      ],
    );

    const { error: insErr } = await supabaseAdmin.from("startup_submissions").insert(row);
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });
