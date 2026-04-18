"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CATEGORY_DEFINITIONS, getCategoryColor } from "@/mmi/lib/categories";
import type { MmiCategory, MmiDataset, MmiImage, MmiProject } from "@/mmi/types";

type Credentials = {
  username: string;
  password: string;
};

const EMPTY_PROJECT: MmiProject = {
  id: "",
  slug: "",
  title: "",
  title_en: "",
  title_hu: null,
  title_zh: null,
  description_hu: null,
  description_en: null,
  description_zh: null,
  year_label: null,
  year_from: null,
  year_to: null,
  location_text: null,
  city: null,
  region: null,
  country: null,
  country_code: null,
  continent: null,
  latitude: null,
  longitude: null,
  category_primary: "Other",
  category_color: getCategoryColor("Other"),
  work_type: null,
  investor: null,
  client: null,
  contractor: null,
  project_manager: null,
  source_url: "https://mmernoki.hu/references",
  source_url_hu: null,
  images: [],
  tags: [],
};

export default function MmiAdmin() {
  const [credentials, setCredentials] = useState<Credentials>({
    username: "",
    password: "",
  });
  const [authHeader, setAuthHeader] = useState<string | null>(null);
  const [dataset, setDataset] = useState<MmiDataset | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<MmiProject | null>(null);
  const [status, setStatus] = useState<string>("");

  const projects = useMemo(() => dataset?.projects ?? [], [dataset]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? null,
    [projects, selectedId],
  );

  async function login() {
    const header = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
    setStatus("Loading projects...");
    const response = await fetch("/api/admin/projects", {
      headers: { authorization: header },
    });

    if (!response.ok) {
      setStatus("Login failed.");
      return;
    }

    const data = (await response.json()) as MmiDataset;
    setAuthHeader(header);
    setDataset(data);
    setSelectedId(data.projects[0]?.id ?? "");
    setDraft(data.projects[0] ?? createNewProject(data.projects));
    setStatus("Admin loaded.");
  }

  function chooseProject(id: string) {
    const project = projects.find((item) => item.id === id);
    setSelectedId(id);
    setDraft(project ? structuredClone(project) : null);
  }

  function newProject() {
    const project = createNewProject(projects);
    setSelectedId(project.id);
    setDraft(project);
  }

  async function saveProject() {
    if (!authHeader || !dataset || !draft) {
      return;
    }

    const normalized = normalizeDraft(draft);
    setStatus("Saving...");
    const response = await fetch("/api/admin/projects", {
      method: "PUT",
      headers: {
        authorization: authHeader,
        "content-type": "application/json",
      },
      body: JSON.stringify({ project: normalized }),
    });

    if (!response.ok) {
      const text = await response.text();
      setStatus(`Save failed: ${text}`);
      return;
    }

    const data = (await response.json()) as MmiDataset;
    setDataset(data);
    setSelectedId(normalized.id);
    setDraft(normalized);
    setStatus("Saved to public/mmi-data/projects.json.");
  }

  if (!authHeader || !dataset || !draft) {
    return (
      <main className="mmi-admin">
        <section className="mmi-admin-login">
          <h1>MMI References Admin</h1>
          <p>Log in to edit the local project dataset.</p>
          <label>
            Username
            <input
              value={credentials.username}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={credentials.password}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
            />
          </label>
          <button type="button" onClick={login}>
            Log in
          </button>
          <p>{status}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mmi-admin">
      <header className="mmi-admin-header">
        <div>
          <h1>MMI References Admin</h1>
          <p>{projects.length} projects in the local dataset</p>
        </div>
        <Link href="/">Open map</Link>
      </header>

      <section className="mmi-admin-grid">
        <aside className="mmi-admin-list">
          <button type="button" onClick={newProject}>
            New project
          </button>
          <select value={selectedProject?.id ?? selectedId} onChange={(event) => chooseProject(event.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.id} - {project.title}
              </option>
            ))}
          </select>
          <p>{status}</p>
        </aside>

        <form className="mmi-admin-form" onSubmit={(event) => event.preventDefault()}>
          <Field label="ID" value={draft.id} onChange={(value) => updateDraft("id", value ?? "")} />
          <Field label="Slug" value={draft.slug} onChange={(value) => updateDraft("slug", value ?? "")} />
          <Field label="Title" value={draft.title} onChange={(value) => updateDraft("title", value ?? "")} />
          <Field label="Title EN" value={draft.title_en} onChange={(value) => updateDraft("title_en", value)} />
          <Field label="Title HU" value={draft.title_hu} onChange={(value) => updateDraft("title_hu", value)} />
          <Field label="Title ZH" value={draft.title_zh} onChange={(value) => updateDraft("title_zh", value)} />
          <Area label="Description EN" value={draft.description_en} onChange={(value) => updateDraft("description_en", value)} />
          <Area label="Description HU" value={draft.description_hu} onChange={(value) => updateDraft("description_hu", value)} />
          <Area label="Description ZH" value={draft.description_zh} onChange={(value) => updateDraft("description_zh", value)} />
          <Field label="Year label" value={draft.year_label} onChange={(value) => updateDraft("year_label", value)} />
          <NumberField label="Year from" value={draft.year_from} onChange={(value) => updateDraft("year_from", value)} />
          <NumberField label="Year to" value={draft.year_to} onChange={(value) => updateDraft("year_to", value)} />
          <Field label="Location text" value={draft.location_text} onChange={(value) => updateDraft("location_text", value)} />
          <Field label="City" value={draft.city} onChange={(value) => updateDraft("city", value)} />
          <Field label="Region" value={draft.region} onChange={(value) => updateDraft("region", value)} />
          <Field label="Country" value={draft.country} onChange={(value) => updateDraft("country", value)} />
          <Field label="Country code" value={draft.country_code} onChange={(value) => updateDraft("country_code", value)} />
          <Field label="Continent" value={draft.continent} onChange={(value) => updateDraft("continent", value)} />
          <NumberField label="Latitude" value={draft.latitude} onChange={(value) => updateDraft("latitude", value)} />
          <NumberField label="Longitude" value={draft.longitude} onChange={(value) => updateDraft("longitude", value)} />

          <label>
            Category
            <select
              value={draft.category_primary}
              onChange={(event) => {
                const category = event.target.value as MmiCategory;
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        category_primary: category,
                        category_color: getCategoryColor(category),
                      }
                    : current,
                );
              }}
            >
              {CATEGORY_DEFINITIONS.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label_en}
                </option>
              ))}
            </select>
          </label>

          <Field label="Category color" value={draft.category_color} onChange={(value) => updateDraft("category_color", value ?? getCategoryColor(draft.category_primary))} />
          <Field label="Work type" value={draft.work_type} onChange={(value) => updateDraft("work_type", value)} />
          <Field label="Investor" value={draft.investor} onChange={(value) => updateDraft("investor", value)} />
          <Field label="Client" value={draft.client} onChange={(value) => updateDraft("client", value)} />
          <Field label="Contractor" value={draft.contractor} onChange={(value) => updateDraft("contractor", value)} />
          <Field label="Project manager" value={draft.project_manager} onChange={(value) => updateDraft("project_manager", value)} />
          <Field label="Source URL" value={draft.source_url} onChange={(value) => updateDraft("source_url", value ?? "https://mmernoki.hu/references")} />
          <Field label="Source URL HU" value={draft.source_url_hu} onChange={(value) => updateDraft("source_url_hu", value)} />
          <Area label="Image URLs, one per line" value={imagesToText(draft.images)} onChange={(value) => updateDraft("images", textToImages(value, draft.title))} />
          <Area label="Tags, one per line" value={draft.tags.join("\n")} onChange={(value) => updateDraft("tags", (value ?? "").split("\n").map((item) => item.trim()).filter(Boolean))} />

          <button type="button" onClick={saveProject}>
            Save project
          </button>
        </form>
      </section>
    </main>
  );

  function updateDraft<Key extends keyof MmiProject>(
    key: Key,
    value: MmiProject[Key],
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <label>
      {label}
      <input value={value ?? ""} onChange={(event) => onChange(nullable(event.target.value))} />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <label>
      {label}
      <textarea value={value ?? ""} onChange={(event) => onChange(nullable(event.target.value))} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label>
      {label}
      <input
        inputMode="decimal"
        value={value ?? ""}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(event.target.value.trim() && Number.isFinite(next) ? next : null);
        }}
      />
    </label>
  );
}

function createNewProject(projects: MmiProject[]): MmiProject {
  const nextId = String(
    Math.max(0, ...projects.map((project) => Number(project.id)).filter(Number.isFinite)) + 1,
  );
  return {
    ...EMPTY_PROJECT,
    id: nextId,
    slug: `manual-${nextId}`,
    title: `New project ${nextId}`,
    title_en: `New project ${nextId}`,
    source_url: `https://mmernoki.hu/references/${nextId}`,
  };
}

function normalizeDraft(project: MmiProject): MmiProject {
  return {
    ...project,
    title: project.title || project.title_en || `Project ${project.id}`,
    title_en: project.title_en || project.title,
    slug: project.slug || `manual-${project.id}`,
    category_color: project.category_color || getCategoryColor(project.category_primary),
    source_url: project.source_url || "https://mmernoki.hu/references",
    images: project.images,
    tags: project.tags,
  };
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function imagesToText(images: MmiImage[]): string {
  return images.map((image) => image.local_path ?? image.url).join("\n");
}

function textToImages(value: string | null, alt: string): MmiImage[] {
  return (value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((url) => ({
      url: url.startsWith("http") ? url : "https://mmernoki.hu/references",
      local_path: url.startsWith("/") ? url : null,
      alt,
    }));
}
