import { createRequire } from "node:module";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import * as cheerio from "cheerio";
import slugify from "slugify";
import { feature } from "topojson-client";

import { inferCategory } from "@/mmi/lib/classification";
import { CATEGORY_DEFINITIONS, getCategoryColor } from "@/mmi/lib/categories";
import {
  cleanText,
  dedupeStrings,
  parseLocationParts,
  parseYearLabel,
} from "@/mmi/lib/normalization";
import { MmiDatasetSchema } from "@/mmi/lib/schema";
import type { MmiDataset, MmiImage, MmiProject } from "@/mmi/types";

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://mmernoki.hu";
const SOURCE_PAGES = [`${BASE_URL}/references`, `${BASE_URL}/referenciak`];
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public", "mmi-data");
const IMAGE_DIR = path.join(OUTPUT_DIR, "images");

type Lang = "en" | "hu";
type ProjectPage = {
  id: string;
  url: string;
  title: string | null;
  fields: Record<string, string>;
  description: string | null;
  imageUrls: string[];
};

type ProjectPair = Partial<Record<Lang, ProjectPage>> & { id: string };

async function main() {
  const links = await collectProjectLinks();
  const pairs = new Map<string, ProjectPair>();

  for (const link of links) {
    const pair = pairs.get(link.id) ?? { id: link.id };
    pair[link.lang] = await scrapeProjectPage(link.url, link.id);
    pairs.set(link.id, pair);
  }

  const projects: MmiProject[] = [];
  for (const pair of [...pairs.values()].sort((a, b) => Number(a.id) - Number(b.id))) {
    projects.push(await normalizeProject(pair));
  }

  const dataset: MmiDataset = {
    metadata: {
      generated_at: new Date().toISOString(),
      source_pages: SOURCE_PAGES,
      project_count: projects.length,
    },
    projects,
  };

  MmiDatasetSchema.parse(dataset);

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUTPUT_DIR, "projects.json"),
    `${JSON.stringify(dataset, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(OUTPUT_DIR, "categories.json"),
    `${JSON.stringify(CATEGORY_DEFINITIONS, null, 2)}\n`,
    "utf8",
  );
  await writeWorldCountries();

  console.log(`MMI ingestion complete: ${projects.length} projects`);
}

async function collectProjectLinks() {
  const links: Array<{ id: string; lang: Lang; url: string }> = [];

  for (const sourceUrl of SOURCE_PAGES) {
    const lang: Lang = sourceUrl.includes("referenciak") ? "hu" : "en";
    const html = await fetchText(sourceUrl);
    const $ = cheerio.load(html);

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      const id = href?.match(/\/(?:references|referenciak)\/(\d+)/)?.[1];
      if (!href || !id) {
        return;
      }

      links.push({
        id,
        lang,
        url: absoluteUrl(href),
      });
    });
  }

  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.lang}:${link.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function scrapeProjectPage(url: string, id: string): Promise<ProjectPage> {
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};

  $(".portfolio-info li").each((_, element) => {
    const label = cleanText($(element).find("strong").first().text());
    const value = cleanText($(element).find("span").first().text());
    if (label && value) {
      fields[normalizeFieldLabel(label)] = value;
    }
  });

  const descriptionParts = extractDescriptionParts($);

  const imageUrls = dedupeStrings(
    $(".gallery-container img")
      .map((_, element) => $(element).attr("data-link") ?? $(element).attr("src"))
      .get()
      .map((value) => (value ? absoluteUrl(value) : null)),
  );

  return {
    id,
    url,
    title:
      cleanText($(".page-header h2").first().text()) ??
      cleanText($("h1").first().text()) ??
      cleanText($("title").first().text()),
    fields,
    description: cleanText(descriptionParts.join("\n\n")),
    imageUrls,
  };
}

function extractDescriptionParts($: cheerio.CheerioAPI): string[] {
  const parts: string[] = [];

  $(".portfolio-description")
    .children()
    .each((_, element) => {
      const tagName = element.tagName?.toLowerCase();
      const html = $(element).html();
      const text = cleanText(html ? htmlFragmentToText(html) : $(element).text());

      if (!text) {
        return;
      }

      if (tagName?.match(/^h[1-6]$/)) {
        parts.push(text);
      } else {
        parts.push(text);
      }
    });

  return parts;
}

function htmlFragmentToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n");
  return cheerio.load(`<div>${withBreaks}</div>`)("div").text();
}

async function normalizeProject(pair: ProjectPair): Promise<MmiProject> {
  const en = pair.en;
  const hu = pair.hu;
  const primary = en ?? hu;

  if (!primary) {
    throw new Error(`Project ${pair.id} has no source pages`);
  }

  const year = parseYearLabel(field(en, hu, "year", "év"));
  const locationText = field(en, hu, "location", "helyszín");
  const location = parseLocationParts(locationText);
  const category = inferCategory(
    en?.title ?? hu?.title,
    `${en?.description ?? ""} ${hu?.description ?? ""}`,
    field(en, hu, "type of work", "munka jellege"),
  );
  const coordinates = location.coordinates ?? (
    location.country ? [location.country.latitude, location.country.longitude] as [number, number] : null
  );

  const images = await downloadImages(
    pair.id,
    dedupeStrings([...(en?.imageUrls ?? []), ...(hu?.imageUrls ?? [])]),
    en?.title ?? hu?.title ?? `MMI project ${pair.id}`,
  );

  const titleEn = en?.title ?? null;
  const titleHu = hu?.title ?? null;
  const title = titleEn ?? titleHu ?? `MMI project ${pair.id}`;

  return {
    id: pair.id,
    slug: slugify(`${pair.id}-${title}`, { lower: true, strict: true }),
    title,
    title_en: titleEn,
    title_hu: titleHu,
    title_zh: null,
    description_hu: hu?.description ?? null,
    description_en: en?.description ?? null,
    description_zh: null,
    year_label: year.yearLabel,
    year_from: year.yearFrom,
    year_to: year.yearTo,
    location_text: locationText,
    city: cleanText(location.city),
    region: cleanText(location.region),
    country: location.country?.country ?? null,
    country_code: location.country?.countryCode ?? null,
    continent: location.country?.continent ?? null,
    latitude: coordinates?.[0] ?? null,
    longitude: coordinates?.[1] ?? null,
    category_primary: category,
    category_color: getCategoryColor(category),
    work_type: field(en, hu, "type of work", "munka jellege"),
    investor: field(en, hu, "investor", "beruházó"),
    client: field(en, hu, "client", "megrendelő"),
    contractor: field(en, hu, "contractor", "kivitelező"),
    project_manager: field(en, hu, "project management", "projektmenedzsment"),
    source_url: en?.url ?? primary.url,
    source_url_hu: hu?.url ?? null,
    images,
    tags: dedupeStrings([
      category,
      location.country?.country,
      location.country?.continent,
      location.city,
      field(en, hu, "type of work", "munka jellege"),
    ]),
  };
}

async function downloadImages(
  projectId: string,
  urls: string[],
  alt: string,
): Promise<MmiImage[]> {
  if (urls.length === 0) {
    return [];
  }

  await mkdir(path.join(IMAGE_DIR, projectId), { recursive: true });
  const images: MmiImage[] = [];

  for (const [index, url] of urls.entries()) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const extension = extensionFromUrl(url) ?? extensionFromType(response.headers.get("content-type")) ?? "jpg";
      const filename = `${String(index + 1).padStart(2, "0")}.${extension}`;
      const absolutePath = path.join(IMAGE_DIR, projectId, filename);
      await writeFile(absolutePath, buffer);

      images.push({
        url,
        local_path: `/mmi-data/images/${projectId}/${filename}`,
        alt,
      });
    } catch (error) {
      console.warn(`Image download failed for ${url}: ${(error as Error).message}`);
      images.push({ url, local_path: null, alt });
    }
  }

  return images;
}

async function writeWorldCountries() {
  const topology = require("world-atlas/countries-110m.json");
  const countriesGeoJson = feature(topology, topology.objects.countries);
  await writeFile(
    path.join(OUTPUT_DIR, "world-countries.geojson"),
    `${JSON.stringify(countriesGeoJson)}\n`,
    "utf8",
  );
}

function field(
  en: ProjectPage | undefined,
  hu: ProjectPage | undefined,
  enLabel: string,
  huLabel: string,
): string | null {
  return en?.fields[enLabel] ?? hu?.fields[huLabel] ?? null;
}

function normalizeFieldLabel(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function absoluteUrl(value: string): string {
  return new URL(value.trim(), BASE_URL).toString();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "MMI local references ingestion/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function extensionFromUrl(url: string): string | null {
  const match = new URL(url).pathname.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function extensionFromType(contentType: string | null): string | null {
  if (!contentType) {
    return null;
  }
  if (contentType.includes("webp")) {
    return "webp";
  }
  if (contentType.includes("png")) {
    return "png";
  }
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }
  return null;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
