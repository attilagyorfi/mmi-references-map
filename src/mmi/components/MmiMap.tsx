"use client";

import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { useEffect, useRef, useState } from "react";

import {
  getCategoryLabel,
  getProjectDescription,
  getProjectTitle,
  type Dictionary,
} from "@/mmi/i18n";
import type { CountryProjectGroup, Language, MmiProject } from "@/mmi/types";

type Props = {
  groups: CountryProjectGroup[];
  detailed: boolean;
  selectedCountry: string | null;
  selectedGroupId: string | null;
  language: Language;
  t: Dictionary;
  onSelectGroup: (group: CountryProjectGroup) => void;
};

type LeafletNamespace = typeof import("leaflet");

const INITIAL_CENTER: [number, number] = [24, 18];
const INITIAL_ZOOM = 2;
const MAX_ZOOM = 19;
const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const REFERENCE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION =
  "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community";

export default function MmiMap({
  groups,
  detailed,
  selectedCountry,
  selectedGroupId,
  language,
  t,
  onSelectGroup,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapVersion, setMapVersion] = useState(0);
  const leafletRef = useRef<LeafletNamespace | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let disposed = false;

    import("leaflet").then((Leaflet) => {
      if (disposed || !containerRef.current || mapRef.current) {
        return;
      }

      leafletRef.current = Leaflet;
      const map = Leaflet.map(containerRef.current, {
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        minZoom: 2,
        maxZoom: MAX_ZOOM,
        zoomControl: false,
        attributionControl: true,
        worldCopyJump: true,
        preferCanvas: true,
        scrollWheelZoom: true,
        touchZoom: true,
        dragging: true,
      });

      Leaflet.tileLayer(SATELLITE_TILES, {
        maxZoom: MAX_ZOOM,
        maxNativeZoom: 19,
        attribution: ATTRIBUTION,
        detectRetina: true,
      }).addTo(map);

      Leaflet.tileLayer(REFERENCE_TILES, {
        maxZoom: MAX_ZOOM,
        maxNativeZoom: 19,
        opacity: 0.76,
        detectRetina: true,
      }).addTo(map);

      markerLayerRef.current = Leaflet.layerGroup().addTo(map);
      mapRef.current = map;
      setMapVersion((value) => value + 1);
      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    const Leaflet = leafletRef.current;
    if (!map || !markerLayer || !Leaflet) {
      return;
    }

    markerLayer.clearLayers();
    const markers: Marker[] = [];

    for (const group of groups) {
      if (!Number.isFinite(group.latitude) || !Number.isFinite(group.longitude)) {
        continue;
      }

      const marker = Leaflet.marker([group.latitude, group.longitude], {
        icon: createMarkerIcon({
          Leaflet,
          group,
          isSelected:
            selectedGroupId === group.id ||
            (!selectedGroupId && selectedCountry === group.country && !detailed),
        }),
        keyboard: true,
        title: group.label,
        riseOnHover: true,
      });

      marker.bindTooltip(buildTooltipHtml(group, language), {
        className: "mmi-leaflet-tooltip",
        direction: "right",
        offset: [16, 0],
        opacity: 1,
        sticky: false,
      });

      marker.on("click", () => {
        marker.openTooltip();
        onSelectGroup(group);
      });
      marker.on("mouseover", () => marker.openTooltip());

      marker.addTo(markerLayer);
      markers.push(marker);
    }

    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      for (const marker of markers) {
        marker.off();
      }
    };
  }, [detailed, groups, language, mapVersion, onSelectGroup, selectedCountry, selectedGroupId]);

  function resetView() {
    mapRef.current?.setView(INITIAL_CENTER, INITIAL_ZOOM, { animate: true });
  }

  return (
    <div className={`mmi-map mmi-tile-map ${detailed ? "detailed" : ""}`}>
      <div className="mmi-zoom-controls" aria-label="Map zoom controls">
        <button type="button" onClick={() => mapRef.current?.zoomIn(1)} aria-label={t.zoomIn}>
          +
        </button>
        <button type="button" onClick={() => mapRef.current?.zoomOut(1)} aria-label={t.zoomOut}>
          -
        </button>
        <button type="button" onClick={resetView}>
          {t.zoomReset}
        </button>
      </div>
      <div ref={containerRef} className="mmi-leaflet-canvas" aria-label="MMI references world map" />
    </div>
  );
}

function createMarkerIcon({
  Leaflet,
  group,
  isSelected,
}: {
  Leaflet: LeafletNamespace;
  group: CountryProjectGroup;
  isSelected: boolean;
}) {
  const isCluster = group.projects.length > 1;
  const className = [
    "mmi-leaflet-marker",
    isCluster ? "cluster" : "single",
    isSelected ? "selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return Leaflet.divIcon({
    className,
    html: `<span style="--marker-color: ${escapeAttribute(group.color)}">${isCluster ? group.projects.length : ""}</span>`,
    iconSize: isCluster ? [34, 34] : [24, 24],
    iconAnchor: isCluster ? [17, 17] : [12, 12],
  });
}

function buildTooltipHtml(group: CountryProjectGroup, language: Language): string {
  if (group.projects.length === 1) {
    const project = group.projects[0];
    const thumbnail = project.images.find((image) => image.local_path)?.local_path;
    const description = getProjectDescription(project, language);

    return `
      <article class="mmi-tooltip-content single">
        ${
          thumbnail
            ? `<img src="${escapeAttribute(thumbnail)}" alt="${escapeAttribute(project.images[0]?.alt ?? project.title)}" />`
            : ""
        }
        <div>
          <strong>${escapeHtml(getProjectTitle(project, language))}</strong>
          ${description ? `<p>${escapeHtml(shorten(description, 150))}</p>` : ""}
        </div>
      </article>
    `;
  }

  return `
    <article class="mmi-tooltip-content cluster">
      <strong>${escapeHtml(group.label)} · ${group.projects.length}</strong>
      ${groupProjectsByCategory(group.projects)
        .map(
          ([category, projects]) => `
            <section>
              <span>${escapeHtml(getCategoryLabel(category, language))}</span>
              <ul>
                ${projects
                  .slice(0, 5)
                  .map((project) => `<li>${escapeHtml(getProjectTitle(project, language))}</li>`)
                  .join("")}
                ${projects.length > 5 ? `<li>+${projects.length - 5}</li>` : ""}
              </ul>
            </section>
          `,
        )
        .join("")}
    </article>
  `;
}

function groupProjectsByCategory(projects: MmiProject[]): Array<[MmiProject["category_primary"], MmiProject[]]> {
  const groups = new Map<MmiProject["category_primary"], MmiProject[]>();
  for (const project of projects) {
    groups.set(project.category_primary, [
      ...(groups.get(project.category_primary) ?? []),
      project,
    ]);
  }

  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function shorten(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1).trim()}...` : compact;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
