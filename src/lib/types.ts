export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
}

export interface Author {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  twitter: string | null;
  linkedin: string | null;
  website: string | null;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  hero_image: string | null;
  author_id: string | null;
  category_id: string | null;
  tags: string[];
  seo_title: string | null;
  meta_description: string | null;
  read_time: number;
  status: "draft" | "published";
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author?: Author | null;
  category?: Category | null;
}

export const SITE_URL = "https://cognarah.com";
