import type { MmiCategory, MmiProject } from "@/mmi/types";

export type ProjectFilters = {
  country: string;
  category: MmiCategory | "all";
  query: string;
  yearFrom: number | null;
  yearTo: number | null;
};

export const DEFAULT_FILTERS: ProjectFilters = {
  country: "all",
  category: "all",
  query: "",
  yearFrom: null,
  yearTo: null,
};

export function filterProjects(
  projects: MmiProject[],
  filters: ProjectFilters,
): MmiProject[] {
  const query = filters.query.trim().toLowerCase();

  return projects.filter((project) => {
    if (filters.country !== "all" && project.country !== filters.country) {
      return false;
    }

    if (filters.category !== "all" && project.category_primary !== filters.category) {
      return false;
    }

    if (!matchesYear(project, filters.yearFrom, filters.yearTo)) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      project.title,
      project.title_en,
      project.title_hu,
      project.location_text,
      project.country,
      project.work_type,
      project.client,
      project.investor,
      project.contractor,
      project.description_en,
      project.description_hu,
      project.tags.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function matchesYear(
  project: MmiProject,
  yearFrom: number | null,
  yearTo: number | null,
): boolean {
  if (yearFrom == null && yearTo == null) {
    return true;
  }

  const projectFrom = project.year_from ?? project.year_to;
  const projectTo = project.year_to ?? project.year_from;
  if (projectFrom == null || projectTo == null) {
    return false;
  }

  const filterFrom = yearFrom ?? Number.NEGATIVE_INFINITY;
  const filterTo = yearTo ?? Number.POSITIVE_INFINITY;

  return projectFrom <= filterTo && projectTo >= filterFrom;
}
