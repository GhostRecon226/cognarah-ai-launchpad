# Cognarah — Full-Stack AI Publication

A complete editorial platform: public blog (TechCrunch-style, AI-only) plus an authenticated CMS. Built on the existing TanStack Start template with Lovable Cloud for database, auth, and storage. The current "coming soon" landing page will be replaced.

## Scope

### Public site
- **Home** — dark navy hero with featured article, latest articles grid (thumbnail, category tag, title, author, date, read time), newsletter signup, footer.
- **Article page** — title, meta row, hero image, rich body, social share (X, LinkedIn, Facebook, WhatsApp), related articles, newsletter.
- **Category pages** — one route per category, with title + description and article grid.
- **About** — mission, coverage, contact.
- **Search** — query input, filter by category and date, empty state.
- **Newsletter signup** — email-only, stored in Cloud.

### CMS (`/admin`, auth-gated)
- **Dashboard** — counts (published, drafts, categories) and recent activity.
- **Articles** — list with status/date/category, create/edit with rich text editor (headers, bold, italic, quotes, lists, inline images), fields: title, slug, author, category, tags, featured image, SEO title, meta description, read time, status (draft/published).
- **Categories** — 11 seeded categories, edit name/description/color.
- **Media library** — upload, list, copy URL.
- **Authors** — name, bio, photo, social links.
- **SEO** — per-article meta plus auto sitemap.
- **Settings** — site name, tagline, logo, social links, newsletter integration field.

### Branding
- Primary `#0A0F2C` navy, accent `#1D9E75` green, plus purple/orange logo accents.
- Cognarah logo top-left (already uploaded as asset).
- Modern sans-serif (Space Grotesk + Inter pairing).
- Dark navy nav + hero; white article body for readability.
- Africa AI nav item visually highlighted.

## Technical approach

- **Stack**: TanStack Start (already configured) + Lovable Cloud (Supabase under the hood) for Postgres, Auth, Storage. Tailwind v4 + shadcn for UI.
- **Hosting**: Lovable hosting (works for Vercel-ready output too; TanStack Start builds standard output).
- **Auth**: Email/password via Cloud. `_authenticated` route gate already exists. CMS lives under `/admin/*` inside the auth group. First signup becomes admin via a `user_roles` table + `has_role` security-definer function.
- **Database tables** (`public` schema, RLS + GRANTs):
  - `categories` (slug, name, description, color, icon, sort_order) — public read, admin write.
  - `authors` (name, slug, bio, photo_url, social JSONB) — public read, admin write.
  - `articles` (title, slug, excerpt, body markdown, hero_image, author_id, category_id, tags text[], seo_title, meta_description, read_time, status, published_at) — public read where `status='published'`, admin full.
  - `newsletter_subscribers` (email, created_at) — public insert only, admin read.
  - `site_settings` (singleton: name, tagline, logo_url, socials JSONB, newsletter_provider) — public read, admin write.
  - `user_roles` (user_id, role enum) + `has_role()` security-definer.
- **Storage**: public `media` bucket for hero/inline images and logo.
- **Rich text**: Tiptap (with image, link, heading, list, blockquote extensions) in CMS; render markdown/HTML on public pages with safe sanitization.
- **Routes**:
  - `/` home, `/about`, `/search`, `/category/$slug`, `/article/$slug`
  - `/auth` (sign-in/up)
  - `/_authenticated/admin` dashboard, `/admin/articles`, `/admin/articles/new`, `/admin/articles/$id`, `/admin/categories`, `/admin/authors`, `/admin/media`, `/admin/settings`
  - `/sitemap.xml` server route generated from published articles.
- **SEO**: per-route `head()` with title, description, OG, canonical; article routes include Article JSON-LD and og:image from hero.
- **Server functions** for newsletter signup (public) and CMS mutations (auth + admin role).
- **Seed**: 11 categories inserted via migration.

## Deliverables (this build)

1. Enable Lovable Cloud, create schema + RLS + grants, seed categories, create `media` storage bucket.
2. Replace landing page; build public site (home, article, category, about, search, newsletter, footer, nav).
3. Build `/auth` and CMS shell with all managers (articles w/ Tiptap, categories, authors, media, settings).
4. Sitemap route, per-route SEO metadata, Africa AI highlight.
5. Verify build + smoke test preview.

## Open items to confirm before I start

1. **Sign-up policy**: Should CMS sign-up be open (first user auto-admin, then admin-only invites) or do you want me to lock it down and grant your specific email admin? If the latter, paste the email.
2. **Newsletter delivery**: Store subscribers in DB only for now, or wire up a provider (Resend, Mailchimp) — needs an API key if so.
3. **Initial content**: Seed a few placeholder articles so the homepage isn't empty, or leave it blank for you to fill in via CMS?
