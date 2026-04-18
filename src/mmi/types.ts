export type Language = "en" | "hu" | "zh";

export type MmiCategory =
  | "Industrial"
  | "Public / Civic"
  | "Residential"
  | "Cement Industry"
  | "Automotive"
  | "Food Industry"
  | "Office / Business"
  | "Logistics / Warehouse"
  | "Healthcare"
  | "Sports"
  | "Education"
  | "Energy / Utilities"
  | "Mining / Materials"
  | "Other";

export type CategoryDefinition = {
  id: MmiCategory;
  label_en: string;
  label_hu: string;
  label_zh: string;
  color: string;
};

export type MmiProject = {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  title_hu: string | null;
  title_zh: string | null;
  description_hu: string | null;
  description_en: string | null;
  description_zh: string | null;
  year_label: string | null;
  year_from: number | null;
  year_to: number | null;
  location_text: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  continent: string | null;
  latitude: number | null;
  longitude: number | null;
  category_primary: MmiCategory;
  category_color: string;
  work_type: string | null;
  investor: string | null;
  client: string | null;
  contractor: string | null;
  project_manager: string | null;
  source_url: string;
  source_url_hu: string | null;
  images: MmiImage[];
  tags: string[];
};

export type MmiImage = {
  url: string;
  local_path: string | null;
  alt: string;
};

export type CountryProjectGroup = {
  id: string;
  label: string;
  placeKind: "country" | "city" | "project";
  country: string;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  continent: string | null;
  latitude: number;
  longitude: number;
  projects: MmiProject[];
  dominantCategory: MmiCategory;
  color: string;
};

export type DatasetMetadata = {
  generated_at: string;
  source_pages: string[];
  project_count: number;
};

export type MmiDataset = {
  metadata: DatasetMetadata;
  projects: MmiProject[];
};
