"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { CATEGORY_DEFINITIONS } from "@/mmi/lib/categories";
import { DEFAULT_FILTERS, filterProjects, type ProjectFilters } from "@/mmi/lib/filtering";
import { groupProjectsForMap } from "@/mmi/lib/grouping";
import {
  dictionaries,
  getCategoryLabel,
  getCountryLabel,
  type Dictionary,
} from "@/mmi/i18n";
import type {
  CategoryDefinition,
  CountryProjectGroup,
  Language,
  MmiDataset,
  MmiProject,
} from "@/mmi/types";

import MmiMap from "./MmiMap";
import PwaInstallButton from "./PwaInstallButton";
import ProjectPanel from "./ProjectPanel";

export default function MmiExperience() {
  const [language, setLanguage] = useState<Language>("en");
  const [dataset, setDataset] = useState<MmiDataset | null>(null);
  const [categories, setCategories] = useState<CategoryDefinition[]>(CATEGORY_DEFINITIONS);
  const [filters, setFilters] = useState<ProjectFilters>(DEFAULT_FILTERS);
  const [selectedGroup, setSelectedGroup] = useState<CountryProjectGroup | null>(null);
  const [selectedProject, setSelectedProject] = useState<MmiProject | null>(null);
  const t = dictionaries[language] satisfies Dictionary;

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetchDataset(),
      fetch("/mmi-data/categories.json").then((response) => response.json()),
    ])
      .then(([projectData, categoryData]) => {
        if (!mounted) {
          return;
        }
        setDataset(projectData);
        setCategories(categoryData);
      })
      .catch((error) => {
        console.error("Unable to load MMI data", error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const projects = useMemo(() => dataset?.projects ?? [], [dataset]);
  const filteredProjects = useMemo(
    () => filterProjects(projects, filters),
    [filters, projects],
  );
  const groups = useMemo(
    () => groupProjectsForMap(filteredProjects, "project"),
    [filteredProjects],
  );
  const countries = useMemo(
    () =>
      [...new Set(projects.map((project) => project.country).filter(Boolean) as string[])].sort(
        (a, b) => a.localeCompare(b),
      ),
    [projects],
  );

  function selectGroup(group: CountryProjectGroup) {
    setSelectedGroup(group);
    setSelectedProject(group.projects.length === 1 ? group.projects[0] : null);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setSelectedGroup(null);
    setSelectedProject(null);
  }

  return (
    <main className="mmi-app">
      <header className="mmi-topbar">
        <div className="mmi-brand">
          <Image
            src="/mmi-data/mmi-logo-30ev.png"
            alt="M Mérnöki Iroda Kft."
            width={112}
            height={42}
            priority
          />
          <div>
            <h1>{t.appTitle}</h1>
            <p>{t.appSubtitle}</p>
          </div>
        </div>

        <div className="mmi-actions">
          <PwaInstallButton t={t} />
          <label>
            <span>{t.language}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
              <option value="en">English</option>
              <option value="hu">Magyar</option>
              <option value="zh">中文</option>
            </select>
          </label>
        </div>
      </header>

      <section className="mmi-filter-bar" aria-label={t.filters}>
        <label>
          <span>{t.country}</span>
          <select
            value={filters.country}
            onChange={(event) =>
              setFilters((current) => ({ ...current, country: event.target.value }))
            }
          >
            <option value="all">{t.allCountries}</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {getCountryLabel(country, language)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{t.category}</span>
          <select
            value={filters.category}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                category: event.target.value as ProjectFilters["category"],
              }))
            }
          >
            <option value="all">{t.allCategories}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {getCategoryLabel(category.id, language)}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={resetFilters}>
          {t.reset}
        </button>
      </section>

      <section className="mmi-workspace">
        <div className="mmi-map-shell">
          <div className="mmi-map-stats">
            <strong>{filteredProjects.length}</strong> {t.filtered}
            <span>
              {projects.length} {t.total}
            </span>
          </div>
          <MmiMap
            groups={groups}
            detailed={filters.country !== "all"}
            language={language}
            selectedCountry={selectedGroup?.country ?? null}
            selectedGroupId={selectedGroup?.id ?? null}
            t={t}
            onSelectGroup={selectGroup}
          />
          <aside className="mmi-legend">
            <h2>{t.legend}</h2>
            <div>
              {categories.map((category) => (
                <span key={category.id}>
                  <i style={{ background: category.color }} />
                  {getCategoryLabel(category.id, language)}
                </span>
              ))}
            </div>
          </aside>
        </div>

        <ProjectPanel
          categories={categories}
          group={selectedGroup}
          language={language}
          project={selectedProject}
          t={t}
          onSelectProject={setSelectedProject}
        />
      </section>
    </main>
  );
}

async function fetchDataset() {
  try {
    const response = await fetch("/api/mmi/projects");

    if (response.ok) {
      return response.json();
    }
  } catch {
    // The static bundle keeps presentation mode usable without a database API.
  }

  const fallbackResponse = await fetch("/mmi-data/projects.json");
  return fallbackResponse.json();
}
