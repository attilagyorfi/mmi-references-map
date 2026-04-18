import { z } from "zod";

import { CATEGORY_DEFINITIONS } from "@/mmi/lib/categories";

const categoryIds = CATEGORY_DEFINITIONS.map((category) => category.id) as [
  string,
  ...string[],
];

export const MmiImageSchema = z.object({
  url: z.string().url(),
  local_path: z.string().nullable(),
  alt: z.string(),
});

export const MmiProjectSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  title_en: z.string().nullable(),
  title_hu: z.string().nullable(),
  title_zh: z.string().nullable(),
  description_hu: z.string().nullable(),
  description_en: z.string().nullable(),
  description_zh: z.string().nullable(),
  year_label: z.string().nullable(),
  year_from: z.number().int().nullable(),
  year_to: z.number().int().nullable(),
  location_text: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  country_code: z.string().nullable(),
  continent: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  category_primary: z.enum(categoryIds),
  category_color: z.string(),
  work_type: z.string().nullable(),
  investor: z.string().nullable(),
  client: z.string().nullable(),
  contractor: z.string().nullable(),
  project_manager: z.string().nullable(),
  source_url: z.string().url(),
  source_url_hu: z.string().url().nullable(),
  images: z.array(MmiImageSchema),
  tags: z.array(z.string()),
});

export const MmiDatasetSchema = z.object({
  metadata: z.object({
    generated_at: z.string(),
    source_pages: z.array(z.string().url()),
    project_count: z.number().int(),
  }),
  projects: z.array(MmiProjectSchema),
});
