import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import slugify from "slugify";

import { getCategoryColor, isMmiCategory } from "@/mmi/lib/categories";
import { inferCategory } from "@/mmi/lib/classification";
import {
  cleanText,
  dedupeStrings,
  parseLocationParts,
  type NormalizedCountry,
} from "@/mmi/lib/normalization";
import { MmiDatasetSchema, MmiProjectSchema } from "@/mmi/lib/schema";
import type { MmiCategory, MmiDataset, MmiImage, MmiProject } from "@/mmi/types";

export const PROJECT_ROOT = path.resolve(process.cwd());
export const DATASET_PATH = path.join(PROJECT_ROOT, "public", "mmi-data", "projects.json");
export const STAGING_DIR = path.join(PROJECT_ROOT, "data", "mmi-staging");
export const IMPORT_IMAGES_DIR = path.join(PROJECT_ROOT, "public", "mmi-data", "images", "imported");
export const EXCEL_PATH = "D:\\_KINAI\\MMI_referenciak prezihez_260420.xlsx";
export const IMAGES_ROOT = "D:\\_KINAI\\kepek";

export type ExcelProjectRecord = {
  staging_id: string;
  source_row: number;
  source_excel_short_name: string;
  source_excel_label: string;
  source_google_maps_url: string | null;
  category_raw: string | null;
  project_label_raw: string | null;
  location_raw: string | null;
  latitude: number | null;
  longitude: number | null;
  country_candidate: string | null;
  city_candidate: string | null;
  region_candidate: string | null;
  country_code_candidate: string | null;
  continent_candidate: string | null;
  final_maps_url: string | null;
  source_status: "imported" | "resolved" | "needs_review";
};

export type IndexedImage = {
  id: string;
  filename: string;
  stem: string;
  extension: string;
  full_path: string;
  category_folder: string | null;
  project_folder: string | null;
  normalized_terms: string[];
  alias_terms: string[];
};

export type ProjectMatch = {
  staging_id: string;
  decision: "matched_existing" | "new_project" | "needs_review";
  confidence: number;
  matched_project_id: string | null;
  matched_project_title: string | null;
  image_ids: string[];
  image_paths: string[];
  notes: string[];
};

export type ReviewItem = {
  staging_id: string;
  short_name: string;
  label: string;
  reasons: string[];
  candidate_project_ids: string[];
  candidate_image_paths: string[];
};

export async function ensureStagingDir() {
  await mkdir(STAGING_DIR, { recursive: true });
}

export async function readDataset(): Promise<MmiDataset> {
  const raw = await readFile(DATASET_PATH, "utf8");
  return MmiDatasetSchema.parse(JSON.parse(raw)) as MmiDataset;
}

export async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function readJsonIfExists<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export function normalizeKey(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(value: string | null | undefined) {
  return normalizeKey(value)
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length > 1);
}

export function parseExcelLabel(value: string | null | undefined) {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return {
      categoryRaw: null,
      projectLabelRaw: null,
      locationRaw: null,
    };
  }

  const parts = cleaned.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      categoryRaw: parts[0],
      projectLabelRaw: parts.slice(1, -1).join(" - "),
      locationRaw: parts.at(-1) ?? null,
    };
  }

  if (parts.length === 2) {
    return {
      categoryRaw: parts[0],
      projectLabelRaw: parts[1],
      locationRaw: null,
    };
  }

  return {
    categoryRaw: null,
    projectLabelRaw: cleaned,
    locationRaw: null,
  };
}

export async function resolveGoogleMapsUrl(url: string | null | undefined) {
  const cleaned = cleanText(url);
  if (!cleaned) {
    return {
      finalUrl: null,
      coordinates: null as [number, number] | null,
    };
  }

  try {
    const response = await fetch(cleaned, { redirect: "follow" });
    const finalUrl = response.url;
    return {
      finalUrl,
      coordinates: extractCoordinatesFromUrl(finalUrl),
    };
  } catch {
    return {
      finalUrl: cleaned,
      coordinates: extractCoordinatesFromUrl(cleaned),
    };
  }
}

export function extractCoordinatesFromUrl(url: string | null | undefined): [number, number] | null {
  const cleaned = cleanText(url);
  if (!cleaned) {
    return null;
  }

  const decoded = decodeURIComponent(cleaned).replace(/\+/g, " ");
  const direct = decoded.match(/\/maps\/search\/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  if (direct) {
    return [Number(direct[1]), Number(direct[2])];
  }

  const query = decoded.match(/[?&]query=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  if (query) {
    return [Number(query[1]), Number(query[2])];
  }

  const atPattern = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atPattern) {
    return [Number(atPattern[1]), Number(atPattern[2])];
  }

  return null;
}

export function mapExcelCategory(
  rawCategory: string | null | undefined,
  projectLabel: string | null | undefined,
) {
  const normalized = normalizeKey(rawCategory);
  const directMap: Record<string, MmiCategory> = {
    cement: "Cement Industry",
    automotive: "Automotive",
    food: "Food Industry",
    public: "Public / Civic",
    wood: "Industrial",
    chemical: "Industrial",
  };

  if (directMap[normalized]) {
    return directMap[normalized];
  }

  const inferred = inferCategory(projectLabel, `${rawCategory ?? ""} ${projectLabel ?? ""}`);
  return isMmiCategory(inferred) ? inferred : "Other";
}

export function buildExcelDescription(record: ExcelProjectRecord) {
  return dedupeStrings([
    record.source_excel_label,
    record.project_label_raw,
    record.location_raw,
  ]).join(" - ");
}

export function scoreProjectMatch(record: ExcelProjectRecord, project: MmiProject) {
  const recordTerms = new Set([
    ...tokenize(record.source_excel_short_name),
    ...tokenize(record.source_excel_label),
    ...tokenize(record.project_label_raw),
    ...tokenize(record.location_raw),
  ]);
  const projectTerms = new Set([
    ...tokenize(project.title),
    ...tokenize(project.title_en),
    ...tokenize(project.title_hu),
    ...tokenize(project.location_text),
    ...tokenize(project.city),
    ...tokenize(project.country),
  ]);

  const overlap = [...recordTerms].filter((term) => projectTerms.has(term));
  let score = overlap.reduce((sum, term) => sum + (term.length > 4 ? 2 : 1), 0);

  if (record.country_candidate && project.country && normalizeKey(record.country_candidate) === normalizeKey(project.country)) {
    score += 2;
  }

  if (
    record.city_candidate &&
    project.city &&
    normalizeKey(record.city_candidate) === normalizeKey(project.city)
  ) {
    score += 2;
  }

  if (
    record.latitude != null &&
    record.longitude != null &&
    project.latitude != null &&
    project.longitude != null
  ) {
    const distance = Math.abs(record.latitude - project.latitude) + Math.abs(record.longitude - project.longitude);
    if (distance < 0.2) {
      score += 3;
    } else if (distance < 1) {
      score += 1;
    }
  }

  return score;
}

const IMAGE_ALIAS_TERMS: Record<string, string[]> = {
  "ddc vac": ["vac", "ddc vac", "ddc"],
  elbeida: ["elbeida", "amouda", "algeria"],
  kiralyegyhaza: ["kiralyegyhaza", "kiralyegyhaza holcim", "kegyhaza"],
  marker: ["marker", "märker", "harburg"],
  "power cement": ["power cement", "pakisztan", "pakistan"],
  agrograin: ["agrograin", "foldvari", "cargill"],
  cukorgyar: ["cukorgyar", "sugar", "sugar factory"],
  julia: ["julia", "malom", "julia mill"],
  nestle: ["nestle", "purina", "buk"],
  nt: ["nt", "sunflower"],
  falco: ["falco"],
  koka: ["koka", "kobanya", "quarry"],
  kronospan: ["kronospan", "strzelce", "osb", "alabama", "kronochem"],
  tkse: ["tkse"],
  viztorony: ["viztorony", "water tower"],
  bmw: ["bmw"],
  bpw: ["bpw"],
  continental: ["continental"],
  "schaeffler emob": ["schaeffler", "e mobility", "emob"],
  "schaeffler log": ["schaeffler", "logistic", "log"],
  "bc render": ["borsodchem", "lfp", "bc"],
  "olajterv hwi alapanyag tartaly": ["olajterv", "hwi", "hazardous waste"],
  "olajterv msa new reactorblokk": ["olajterv", "msa", "maleic anhydride"],
  pet: ["pet", "petfuerdo", "petfurdo", "nitrogenmuvek"],
  richter: ["richter", "gedeon"],
};

export function getImageAliasTerms(stem: string) {
  const normalizedStem = normalizeKey(stem);
  const direct = IMAGE_ALIAS_TERMS[normalizedStem] ?? [];
  return dedupeStrings([...normalizedStem.split(" "), ...direct]);
}

export function scoreImageMatch(record: ExcelProjectRecord, image: IndexedImage, existingProject?: MmiProject | null) {
  const recordTerms = new Set([
    ...tokenize(record.source_excel_short_name),
    ...tokenize(record.source_excel_label),
    ...tokenize(record.project_label_raw),
    ...tokenize(record.location_raw),
    ...tokenize(existingProject?.title),
    ...tokenize(existingProject?.title_en),
  ].filter((term) => term.length > 2));
  const imageTerms = new Set([
    ...image.normalized_terms,
    ...image.alias_terms,
    ...tokenize(image.category_folder),
    ...tokenize(image.project_folder),
  ].filter((term) => term.length > 2));

  let score = 0;
  for (const term of recordTerms) {
    if (imageTerms.has(term)) {
      score += term.length > 4 ? 2 : 1;
    }
  }

  const imageStem = normalizeKey(image.stem);
  const shortName = normalizeKey(record.source_excel_short_name);
  const label = normalizeKey(record.source_excel_label);
  const projectLabel = normalizeKey(record.project_label_raw);

  if (shortName && (imageStem === shortName || imageStem.includes(shortName) || shortName.includes(imageStem))) {
    score += 5;
  }

  if (
    projectLabel &&
    (imageStem === projectLabel || imageStem.includes(projectLabel) || projectLabel.includes(imageStem))
  ) {
    score += 4;
  }

  if (label && imageStem && label.includes(imageStem)) {
    score += 3;
  }

  const category = normalizeKey(record.category_raw);
  const folder = normalizeKey(image.category_folder);
  if (score > 0 && category && folder) {
    if (
      (category === "cement" && folder === "cement") ||
      (category === "food" && folder === "elelmiszer") ||
      (category === "automotive" && folder === "jarmu") ||
      (category === "chemical" && folder === "vegyipar") ||
      (category === "wood" && folder === "ipari") ||
      (category === "public" && folder === "ipari")
    ) {
      score += 2;
    }
  }

  return score;
}

export function selectCountryFromRecord(record: ExcelProjectRecord): NormalizedCountry | null {
  return parseLocationParts(record.location_raw).country;
}

export function buildImportedProject(record: ExcelProjectRecord, images: MmiImage[]): MmiProject {
  const category = mapExcelCategory(record.category_raw, record.project_label_raw);
  const location = parseLocationParts(record.location_raw);
  const country = location.country ?? selectCountryFromRecord(record);
  const baseTitle = cleanText(record.project_label_raw) ?? cleanText(record.source_excel_short_name) ?? record.staging_id;
  const titleEn = baseTitle;
  const titleHu = cleanText(record.source_excel_short_name) ?? baseTitle;

  return MmiProjectSchema.parse({
    id: `excel-${record.source_row}`,
    slug: slugify(`${record.source_row}-${baseTitle}`, { lower: true, strict: true }),
    title: titleEn,
    title_en: titleEn,
    title_hu: titleHu,
    title_zh: null,
    description_hu: null,
    description_en: buildExcelDescription(record) || null,
    description_zh: null,
    year_label: null,
    year_from: null,
    year_to: null,
    location_text: record.location_raw,
    city: record.city_candidate,
    region: record.region_candidate,
    country: record.country_candidate ?? country?.country ?? null,
    country_code: record.country_code_candidate ?? country?.countryCode ?? null,
    continent: record.continent_candidate ?? country?.continent ?? null,
    latitude: record.latitude,
    longitude: record.longitude,
    category_primary: category,
    category_color: getCategoryColor(category),
    work_type: record.category_raw,
    investor: null,
    client: null,
    contractor: null,
    project_manager: null,
    source_url: record.final_maps_url ?? "https://maps.google.com",
    source_url_hu: null,
    images,
    tags: dedupeStrings([
      "excel-import",
      record.category_raw,
      record.project_label_raw,
      record.country_candidate,
      record.city_candidate,
    ]),
  }) as MmiProject;
}

export function refreshImportedProject(existing: MmiProject, record: ExcelProjectRecord): MmiProject {
  const rebuilt = buildImportedProject(record, existing.images);

  return MmiProjectSchema.parse({
    ...existing,
    ...rebuilt,
    images: dedupeImportedImages([...existing.images, ...rebuilt.images], rebuilt.title),
    tags: dedupeStrings([...existing.tags, ...rebuilt.tags]),
  }) as MmiProject;
}

function dedupeImportedImages(images: MmiImage[], alt: string) {
  const seen = new Set<string>();

  return images.filter((image) => {
    const key = image.local_path ?? image.url;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    image.alt = image.alt || alt;
    return true;
  });
}

export async function copyImagesForProject(projectId: string, images: IndexedImage[]) {
  const targetDir = path.join(IMPORT_IMAGES_DIR, projectId);
  await mkdir(targetDir, { recursive: true });

  const copied: MmiImage[] = [];
  let index = 1;

  for (const image of images) {
    const extension = image.extension.toLowerCase() || ".jpg";
    const filename = `${String(index).padStart(2, "0")}${extension}`;
    const destination = path.join(targetDir, filename);
    await copyFile(image.full_path, destination);

    copied.push({
      url: `https://mmi.local/imported/${projectId}/${filename}`,
      local_path: `/mmi-data/images/imported/${projectId}/${filename}`,
      alt: projectId,
    });
    index += 1;
  }

  return copied;
}
