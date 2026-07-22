import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { SITE_URL } from "@/lib/types";
import { submitStartup, type CofounderInput, type ScreenshotUpload } from "@/lib/startup-submissions.functions";

export const Route = createFileRoute("/startups/submit")({
  head: () => ({
    meta: [
      { title: "Submit Your Startup: Cognarah" },
      {
        name: "description",
        content:
          "Are you building something great with AI? Submit your startup to Cognarah for review and a chance to be featured.",
      },
      { property: "og:title", content: "Submit Your Startup: Cognarah" },
      {
        property: "og:description",
        content: "Tell us about your AI startup. We review every submission.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/startups/submit` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/startups/submit` }],
  }),
  component: SubmitPage,
});

const STAGES = ["Idea", "Pre-seed", "Seed", "Series A", "Series B+"];
const TEAM_SIZES = ["1-5", "6-15", "16-50", "50+"];
const REVENUE = ["Pre-revenue", "Early revenue", "Growing revenue"];
const CONTACT = ["Email", "LinkedIn", "WhatsApp"];
const TECHS = [
  "Large Language Models",
  "Computer Vision",
  "Natural Language Processing",
  "Predictive Analytics",
  "Robotics",
  "Other",
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function SubmitPage() {
  const submit = useServerFn(submitStartup);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contactMethod, setContactMethod] = useState("Email");
  const [techs, setTechs] = useState<string[]>([]);
  const [logo, setLogo] = useState<File | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [cofounders, setCofounders] = useState<CofounderInput[]>([]);

  function toggleTech(t: string) {
    setTechs((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function updateCofounder(i: number, key: keyof CofounderInput, val: string) {
    setCofounders((prev) => prev.map((c, idx) => (idx === i ? { ...c, [key]: val } : c)));
  }

  function addCofounder() {
    if (cofounders.length >= 4) return;
    setCofounders((prev) => [...prev, { name: "", role: "", linkedin: "" }]);
  }

  function removeCofounder(i: number) {
    setCofounders((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onScreenshotsChange(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).slice(0, 3);
    const oversize = arr.find((f) => f.size > 2 * 1024 * 1024);
    if (oversize) {
      toast.error("Each screenshot must be 2MB or smaller");
      return;
    }
    setScreenshots(arr);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const fd = new FormData(e.currentTarget);

    if (!logo) {
      toast.error("Please upload a logo");
      return;
    }
    if (logo.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2MB or smaller");
      return;
    }
    if (techs.length === 0) {
      toast.error("Select at least one AI technology");
      return;
    }

    setSubmitting(true);
    try {
      const logoB64 = await fileToBase64(logo);
      const shots: ScreenshotUpload[] = [];
      for (const f of screenshots) {
        shots.push({ base64: await fileToBase64(f), name: f.name, type: f.type });
      }
      await submit({
        data: {
          company_name: String(fd.get("company_name") || ""),
          tagline: String(fd.get("tagline") || ""),
          website_url: String(fd.get("website_url") || ""),
          company_linkedin: String(fd.get("company_linkedin") || ""),
          twitter_handle: String(fd.get("twitter_handle") || ""),
          youtube_url: String(fd.get("youtube_url") || ""),
          country: String(fd.get("country") || ""),
          city: String(fd.get("city") || ""),
          year_founded: Number(fd.get("year_founded") || 0),
          company_stage: String(fd.get("company_stage") || ""),
          product_description: String(fd.get("product_description") || ""),
          problem_solved: String(fd.get("problem_solved") || ""),
          mission: String(fd.get("mission") || ""),
          differentiator: String(fd.get("differentiator") || ""),
          competitors: String(fd.get("competitors") || ""),
          business_model: String(fd.get("business_model") || ""),
          pricing_model: String(fd.get("pricing_model") || ""),
          markets_served: String(fd.get("markets_served") || ""),
          target_audience: String(fd.get("target_audience") || ""),
          ai_technologies: techs,
          founder_name: String(fd.get("founder_name") || ""),
          founder_linkedin: String(fd.get("founder_linkedin") || ""),
          cofounders: cofounders,
          key_team_members: String(fd.get("key_team_members") || ""),
          team_size: String(fd.get("team_size") || ""),
          user_count: String(fd.get("user_count") || ""),
          revenue_stage: String(fd.get("revenue_stage") || ""),
          funding_raised: String(fd.get("funding_raised") || ""),
          notable_investors: String(fd.get("notable_investors") || ""),
          partnerships: String(fd.get("partnerships") || ""),
          milestones: String(fd.get("milestones") || ""),
          awards: String(fd.get("awards") || ""),
          product_demo: String(fd.get("product_demo") || ""),
          pitch_video_url: String(fd.get("pitch_video_url") || ""),
          press_links: String(fd.get("press_links") || ""),
          roadmap: String(fd.get("roadmap") || ""),
          founder_email: String(fd.get("founder_email") || ""),
          contact_method: contactMethod,
          whatsapp_number: String(fd.get("whatsapp_number") || ""),
          consent: fd.get("consent") === "on",
          logo_file_base64: logoB64,
          logo_file_name: logo.name,
          logo_file_type: logo.type,
          screenshots: shots,
        },
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1 bg-navy text-navy-foreground">
        <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">Startups</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Submit Your Startup
          </h1>
          <p className="mt-6 text-base text-white/75 sm:text-lg">
            Are you building something great with AI? Tell us about your startup. The more detail you
            share, the better the profile we can craft for you. Fields marked with an asterisk are
            required; everything else is optional but strongly encouraged.
          </p>

          {submitted ? (
            <div className="mt-10 rounded-lg border border-brand/40 bg-white/5 p-6">
              <h2 className="text-xl font-bold text-brand">Thanks for submitting.</h2>
              <p className="mt-3 text-white/80">
                We review every submission carefully and will be in touch if we decide to feature
                your startup on Cognarah.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-10 space-y-10">
              <Section title="Basic identity">
                <Field label="Company name" required>
                  <input name="company_name" required className={inputCls} />
                </Field>
                <Field label="One-line tagline" hint="Max 160 characters">
                  <input name="tagline" maxLength={160} className={inputCls} />
                </Field>
                <Field label="Website URL" required hint="We'll add https:// automatically">
                  <input name="website_url" type="text" required placeholder="example.com" className={inputCls} />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Country" required>
                    <input name="country" required className={inputCls} />
                  </Field>
                  <Field label="City" required>
                    <input name="city" required className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Year founded" required>
                    <input
                      name="year_founded"
                      type="number"
                      min={1900}
                      max={new Date().getFullYear() + 1}
                      required
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Company stage" required>
                    <select name="company_stage" required defaultValue="" className={inputCls}>
                      <option value="" disabled style={optionStyle}>
                        Select stage
                      </option>
                      {STAGES.map((s) => (
                        <option key={s} value={s} style={optionStyle}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Markets served" hint="Comma separated, e.g. Nigeria, Kenya, Ghana">
                  <input name="markets_served" className={inputCls} />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Company LinkedIn">
                    <input name="company_linkedin" type="url" placeholder="https://linkedin.com/company/..." className={inputCls} />
                  </Field>
                  <Field label="Twitter / X handle">
                    <input name="twitter_handle" placeholder="@yourcompany" className={inputCls} />
                  </Field>
                </div>
                <Field label="YouTube URL">
                  <input name="youtube_url" type="url" className={inputCls} />
                </Field>
              </Section>

              <Section title="Product and mission">
                <Field label="What your product does" required hint="Be detailed. Max 1500 characters.">
                  <textarea
                    name="product_description"
                    required
                    maxLength={1500}
                    rows={6}
                    className={inputCls}
                  />
                </Field>
                <Field label="Problem it solves" required hint="Max 1500 characters">
                  <textarea
                    name="problem_solved"
                    required
                    maxLength={1500}
                    rows={5}
                    className={inputCls}
                  />
                </Field>
                <Field label="Mission statement" hint="Max 500 characters">
                  <textarea name="mission" maxLength={500} rows={3} className={inputCls} />
                </Field>
                <Field label="What makes you different" hint="Your unfair advantage. Max 1000 characters.">
                  <textarea name="differentiator" maxLength={1000} rows={4} className={inputCls} />
                </Field>
                <Field label="Main competitors" hint="Max 500 characters">
                  <input name="competitors" maxLength={500} className={inputCls} />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Business model" hint="e.g. B2B SaaS, marketplace, API">
                    <input name="business_model" maxLength={500} className={inputCls} />
                  </Field>
                  <Field label="Pricing model" hint="e.g. subscription, usage-based">
                    <input name="pricing_model" maxLength={300} className={inputCls} />
                  </Field>
                </div>
                <Field label="Target audience" required>
                  <input name="target_audience" required className={inputCls} />
                </Field>
                <Field label="AI technology used" required>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {TECHS.map((t) => (
                      <label
                        key={t}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={techs.includes(t)}
                          onChange={() => toggleTech(t)}
                          className="h-4 w-4 accent-brand"
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                </Field>
              </Section>

              <Section title="Team">
                <Field label="Founder name" required>
                  <input name="founder_name" required className={inputCls} />
                </Field>
                <Field label="Founder LinkedIn URL">
                  <input name="founder_linkedin" type="url" placeholder="https://linkedin.com/in/..." className={inputCls} />
                </Field>
                <Field label="Team size" required>
                  <select name="team_size" required defaultValue="" className={inputCls}>
                    <option value="" disabled style={optionStyle}>
                      Select team size
                    </option>
                    {TEAM_SIZES.map((s) => (
                      <option key={s} value={s} style={optionStyle}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/90">Co-founders (up to 4)</span>
                    <button
                      type="button"
                      onClick={addCofounder}
                      disabled={cofounders.length >= 4}
                      className="rounded-md border border-brand/60 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/20 disabled:opacity-40"
                    >
                      Add co-founder
                    </button>
                  </div>
                  {cofounders.length === 0 && (
                    <p className="text-xs text-white/50">Optional. Add each co-founder's name, role, and LinkedIn.</p>
                  )}
                  {cofounders.map((c, i) => (
                    <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-white/15 bg-white/5 p-3 sm:grid-cols-3">
                      <input
                        placeholder="Name"
                        value={c.name || ""}
                        onChange={(e) => updateCofounder(i, "name", e.target.value)}
                        className={inputCls}
                      />
                      <input
                        placeholder="Role"
                        value={c.role || ""}
                        onChange={(e) => updateCofounder(i, "role", e.target.value)}
                        className={inputCls}
                      />
                      <div className="flex gap-2">
                        <input
                          placeholder="LinkedIn URL"
                          value={c.linkedin || ""}
                          onChange={(e) => updateCofounder(i, "linkedin", e.target.value)}
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() => removeCofounder(i)}
                          className="rounded-md border border-red-400/40 bg-red-500/10 px-2 text-xs font-semibold text-red-200 hover:bg-red-500/20"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <Field label="Other key team members" hint="Optional. Names and roles, one per line.">
                  <textarea name="key_team_members" maxLength={1000} rows={3} className={inputCls} />
                </Field>
              </Section>

              <Section title="Traction and milestones">
                <Field label="Current number of users or customers">
                  <input name="user_count" className={inputCls} />
                </Field>
                <Field label="Revenue stage" required>
                  <select name="revenue_stage" required defaultValue="" className={inputCls}>
                    <option value="" disabled style={optionStyle}>
                      Select revenue stage
                    </option>
                    {REVENUE.map((s) => (
                      <option key={s} value={s} style={optionStyle}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Funding raised to date">
                  <input name="funding_raised" className={inputCls} />
                </Field>
                <Field label="Notable investors">
                  <input name="notable_investors" className={inputCls} />
                </Field>
                <Field label="Key partnerships or clients">
                  <input name="partnerships" className={inputCls} />
                </Field>
                <Field label="Milestones so far" hint="Launches, revenue, user count, expansions. Max 1000 characters.">
                  <textarea name="milestones" maxLength={1000} rows={4} className={inputCls} />
                </Field>
                <Field label="Awards or recognition" hint="Max 500 characters">
                  <textarea name="awards" maxLength={500} rows={2} className={inputCls} />
                </Field>
                <Field label="Roadmap and what's next" hint="Max 800 characters">
                  <textarea name="roadmap" maxLength={800} rows={4} className={inputCls} />
                </Field>
              </Section>

              <Section title="Media">
                <Field label="Logo upload" required hint="PNG or JPG, max 2MB">
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-white/80 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-semibold file:text-navy hover:file:bg-brand/90"
                  />
                </Field>
                <Field label="Product screenshots" hint="Up to 3 images. PNG or JPG, max 2MB each.">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => onScreenshotsChange(e.target.files)}
                    className="block w-full text-sm text-white/80 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-semibold file:text-navy hover:file:bg-brand/90"
                  />
                  {screenshots.length > 0 && (
                    <p className="mt-1 text-xs text-white/60">{screenshots.length} file(s) selected</p>
                  )}
                </Field>
                <Field label="Product demo link">
                  <input name="product_demo" className={inputCls} />
                </Field>
                <Field label="Pitch video URL">
                  <input name="pitch_video_url" type="url" className={inputCls} />
                </Field>
                <Field label="Press coverage links">
                  <textarea name="press_links" rows={3} className={inputCls} />
                </Field>
              </Section>

              <Section title="Contact">
                <Field label="Founder email" required>
                  <input name="founder_email" type="email" required className={inputCls} />
                </Field>
                <Field label="Preferred contact method" required>
                  <select
                    name="contact_method"
                    required
                    value={contactMethod}
                    onChange={(e) => setContactMethod(e.target.value)}
                    className={inputCls}
                  >
                    {CONTACT.map((c) => (
                      <option key={c} value={c} style={optionStyle}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                {contactMethod === "WhatsApp" && (
                  <Field label="WhatsApp number" required>
                    <input
                      name="whatsapp_number"
                      required
                      placeholder="+234..."
                      className={inputCls}
                    />
                  </Field>
                )}
              </Section>

              <label className="flex items-start gap-3 rounded-md border border-white/15 bg-white/5 p-4 text-sm">
                <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 accent-brand" />
                <span>
                  I confirm the information provided is accurate and I consent to Cognarah
                  publishing a profile about my startup.
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-brand px-6 py-3 text-base font-bold text-navy transition hover:bg-brand/90 disabled:opacity-60 sm:w-auto"
              >
                {submitting ? "Submitting..." : "Submit Your Startup"}
              </button>
            </form>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

const inputCls =
  "block w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

const optionStyle: React.CSSProperties = { color: "#0f172a", backgroundColor: "#ffffff" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="border-b border-white/15 pb-2 text-lg font-bold uppercase tracking-wide text-brand">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-white/90">
        {label}
        {required && <span className="ml-1 text-brand">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-white/50">{hint}</span>}
    </label>
  );
}
