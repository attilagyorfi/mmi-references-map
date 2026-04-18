import type { CountryProjectGroup, MmiProject } from "@/mmi/types";
import { getCategoryColor } from "@/mmi/lib/categories";

export function groupProjectsByCountry(projects: MmiProject[]): CountryProjectGroup[] {
  return groupProjectsForMap(projects, "country");
}

export function groupProjectsForMap(
  projects: MmiProject[],
  mode: "country" | "city" | "project",
): CountryProjectGroup[] {
  const groups = new Map<string, MmiProject[]>();

  for (const project of projects) {
    if (project.country && project.latitude != null && project.longitude != null) {
      const key =
        mode === "project"
          ? getProjectLocationKey(project)
          : mode === "city"
            ? `${project.country_code ?? project.country}:${project.city ?? project.location_text ?? project.id}`
            : project.country_code ?? project.country;
      groups.set(key, [...(groups.get(key) ?? []), project]);
    }
  }

  return [...groups.values()]
    .map((countryProjects) => {
      const first = countryProjects[0];
      const dominantCategory = getDominantCategory(countryProjects);
      const placeKind: CountryProjectGroup["placeKind"] =
        mode === "project" ? "project" : mode === "city" ? "city" : "country";
      const label =
        placeKind === "project"
          ? first.city ?? first.location_text ?? first.title
          : placeKind === "city"
            ? first.city ?? first.location_text ?? first.country ?? "Unknown"
            : first.country ?? "Unknown";

      return {
        id:
          placeKind === "project"
            ? getProjectLocationKey(first)
            : placeKind === "city"
              ? `${first.country_code ?? first.country}:${label}`
              : first.country_code ?? first.country ?? label,
        label,
        placeKind,
        country: first.country ?? "Unknown",
        countryCode: first.country_code,
        city: first.city,
        region: first.region,
        continent: first.continent,
        latitude: average(countryProjects.map((project) => project.latitude)),
        longitude: average(countryProjects.map((project) => project.longitude)),
        projects: countryProjects,
        dominantCategory,
        color:
          countryProjects.length === 1
            ? countryProjects[0].category_color
            : getCategoryColor(dominantCategory),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function getProjectLocationKey(project: MmiProject): string {
  const country = project.country_code ?? project.country ?? "unknown";
  if (project.city) {
    return `${country}:city:${normalizeKey(project.city)}`;
  }

  if (project.latitude != null && project.longitude != null) {
    return `${country}:geo:${project.latitude.toFixed(2)}:${project.longitude.toFixed(2)}`;
  }

  return `${country}:project:${project.id}`;
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getDominantCategory(projects: MmiProject[]) {
  const counts = new Map<string, number>();
  for (const project of projects) {
    counts.set(project.category_primary, (counts.get(project.category_primary) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] as MmiProject["category_primary"];
}

function average(values: Array<number | null>): number {
  const usable = values.filter((value): value is number => value != null);
  return usable.reduce((sum, value) => sum + value, 0) / Math.max(usable.length, 1);
}
