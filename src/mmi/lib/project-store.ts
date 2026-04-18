import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { MmiDatasetSchema, MmiProjectSchema } from "@/mmi/lib/schema";
import type { MmiDataset, MmiProject } from "@/mmi/types";

const DATASET_PATH = path.join(process.cwd(), "public", "mmi-data", "projects.json");
const SOURCE_PAGES = [
  "https://mmernoki.hu/references",
  "https://mmernoki.hu/referenciak",
];

let pool: Pool | null = null;

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export async function readProjectDataset(): Promise<MmiDataset> {
  if (hasDatabaseUrl()) {
    return readDatabaseDataset();
  }

  return readJsonDataset();
}

export async function upsertProject(project: MmiProject): Promise<MmiDataset> {
  const parsedProject = MmiProjectSchema.parse(project) as MmiProject;

  if (hasDatabaseUrl()) {
    await ensureProjectTable();
    await upsertDatabaseProject(parsedProject);
    return readDatabaseDataset();
  }

  const dataset = await readJsonDataset();
  const projects = upsertProjectInList(dataset.projects, parsedProject);
  const nextDataset = buildDataset(projects, dataset.metadata.source_pages);

  await writeJsonDataset(nextDataset);
  return nextDataset;
}

export async function replaceAllProjects(projects: MmiProject[]) {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is required for database import.");
  }

  await ensureProjectTable();
  const parsedProjects = projects.map(
    (project) => MmiProjectSchema.parse(project) as MmiProject,
  );
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query("delete from mmi_projects");

    for (const project of parsedProjects) {
      await upsertDatabaseProject(project, client);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function exportDatabaseToJson() {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is required for database export.");
  }

  const dataset = await readDatabaseDataset();
  await writeJsonDataset(dataset);
  return dataset;
}

export async function ensureProjectTable() {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is required to initialize the database.");
  }

  await getPool().query(`
    create table if not exists mmi_projects (
      id text primary key,
      slug text not null,
      title text not null,
      title_en text,
      title_hu text,
      title_zh text,
      description_hu text,
      description_en text,
      description_zh text,
      year_label text,
      year_from integer,
      year_to integer,
      location_text text,
      city text,
      region text,
      country text,
      country_code text,
      continent text,
      latitude double precision,
      longitude double precision,
      category_primary text not null,
      category_color text not null,
      work_type text,
      investor text,
      client text,
      contractor text,
      project_manager text,
      source_url text not null,
      source_url_hu text,
      images jsonb not null default '[]'::jsonb,
      tags jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now()
    );
  `);

  await getPool().query(`
    create index if not exists mmi_projects_country_idx on mmi_projects (country);
    create index if not exists mmi_projects_category_idx on mmi_projects (category_primary);
    create index if not exists mmi_projects_city_idx on mmi_projects (city);
    create index if not exists mmi_projects_year_idx on mmi_projects (year_from, year_to);
  `);
}

async function readJsonDataset() {
  const raw = await readFile(DATASET_PATH, "utf8");
  return MmiDatasetSchema.parse(JSON.parse(raw)) as MmiDataset;
}

async function writeJsonDataset(dataset: MmiDataset) {
  await writeFile(DATASET_PATH, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
}

async function readDatabaseDataset() {
  await ensureProjectTable();
  const result = await getPool().query("select * from mmi_projects");
  return buildDataset(result.rows.map(rowToProject), SOURCE_PAGES);
}

async function upsertDatabaseProject(project: MmiProject, client?: PoolClient) {
  const executor = client ?? getPool();
  const values = projectToValues(project);

  await executor.query(
    `
      insert into mmi_projects (
        id, slug, title, title_en, title_hu, title_zh,
        description_hu, description_en, description_zh,
        year_label, year_from, year_to,
        location_text, city, region, country, country_code, continent,
        latitude, longitude,
        category_primary, category_color, work_type,
        investor, client, contractor, project_manager,
        source_url, source_url_hu, images, tags
      )
      values (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20,
        $21, $22, $23,
        $24, $25, $26, $27,
        $28, $29, $30::jsonb, $31::jsonb
      )
      on conflict (id) do update set
        slug = excluded.slug,
        title = excluded.title,
        title_en = excluded.title_en,
        title_hu = excluded.title_hu,
        title_zh = excluded.title_zh,
        description_hu = excluded.description_hu,
        description_en = excluded.description_en,
        description_zh = excluded.description_zh,
        year_label = excluded.year_label,
        year_from = excluded.year_from,
        year_to = excluded.year_to,
        location_text = excluded.location_text,
        city = excluded.city,
        region = excluded.region,
        country = excluded.country,
        country_code = excluded.country_code,
        continent = excluded.continent,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        category_primary = excluded.category_primary,
        category_color = excluded.category_color,
        work_type = excluded.work_type,
        investor = excluded.investor,
        client = excluded.client,
        contractor = excluded.contractor,
        project_manager = excluded.project_manager,
        source_url = excluded.source_url,
        source_url_hu = excluded.source_url_hu,
        images = excluded.images,
        tags = excluded.tags,
        updated_at = now()
    `,
    values,
  );
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    const isLocalDatabase =
      process.env.DATABASE_URL.includes("localhost") ||
      process.env.DATABASE_URL.includes("127.0.0.1");
    const useSsl = process.env.DATABASE_SSL === "true" || (!isLocalDatabase && process.env.DATABASE_SSL !== "false");

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    });
  }

  return pool;
}

function projectToValues(project: MmiProject) {
  return [
    project.id,
    project.slug,
    project.title,
    project.title_en,
    project.title_hu,
    project.title_zh,
    project.description_hu,
    project.description_en,
    project.description_zh,
    project.year_label,
    project.year_from,
    project.year_to,
    project.location_text,
    project.city,
    project.region,
    project.country,
    project.country_code,
    project.continent,
    project.latitude,
    project.longitude,
    project.category_primary,
    project.category_color,
    project.work_type,
    project.investor,
    project.client,
    project.contractor,
    project.project_manager,
    project.source_url,
    project.source_url_hu,
    JSON.stringify(project.images),
    JSON.stringify(project.tags),
  ];
}

function rowToProject(row: QueryResultRow): MmiProject {
  return MmiProjectSchema.parse({
    id: row.id,
    slug: row.slug,
    title: row.title,
    title_en: row.title_en,
    title_hu: row.title_hu,
    title_zh: row.title_zh,
    description_hu: row.description_hu,
    description_en: row.description_en,
    description_zh: row.description_zh,
    year_label: row.year_label,
    year_from: row.year_from,
    year_to: row.year_to,
    location_text: row.location_text,
    city: row.city,
    region: row.region,
    country: row.country,
    country_code: row.country_code,
    continent: row.continent,
    latitude: row.latitude,
    longitude: row.longitude,
    category_primary: row.category_primary,
    category_color: row.category_color,
    work_type: row.work_type,
    investor: row.investor,
    client: row.client,
    contractor: row.contractor,
    project_manager: row.project_manager,
    source_url: row.source_url,
    source_url_hu: row.source_url_hu,
    images: normalizeJsonArray(row.images),
    tags: normalizeJsonArray(row.tags),
  }) as MmiProject;
}

function normalizeJsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return JSON.parse(value);
  }

  return [];
}

function upsertProjectInList(projects: MmiProject[], project: MmiProject) {
  const index = projects.findIndex((item) => item.id === project.id);
  const nextProjects =
    index === -1
      ? [...projects, project]
      : projects.map((item) => (item.id === project.id ? project : item));

  return sortProjects(nextProjects);
}

function buildDataset(projects: MmiProject[], sourcePages = SOURCE_PAGES): MmiDataset {
  return MmiDatasetSchema.parse({
    metadata: {
      generated_at: new Date().toISOString(),
      source_pages: sourcePages.length ? sourcePages : SOURCE_PAGES,
      project_count: projects.length,
    },
    projects: sortProjects(projects),
  }) as MmiDataset;
}

function sortProjects(projects: MmiProject[]) {
  return [...projects].sort((a, b) => {
    const aNumber = Number(a.id);
    const bNumber = Number(b.id);

    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
      return aNumber - bNumber;
    }

    return a.id.localeCompare(b.id, "en", { numeric: true });
  });
}
