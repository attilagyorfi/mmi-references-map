"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type Geometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

type GeoFeature = {
  type: "Feature";
  properties?: {
    name?: string;
    NAME?: string;
    NAME_LONG?: string;
    ADMIN?: string;
  };
  geometry: Geometry | null;
};

type GeoJson = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  center: [number, number];
  moved: boolean;
};

type PointerPoint = {
  x: number;
  y: number;
};

type PinchState = {
  distance: number;
  zoom: number;
  mapPoint: [number, number];
};

const WIDTH = 1200;
const HEIGHT = 620;
const MIN_LAT = -58;
const MAX_LAT = 82;
const MIN_ZOOM = 1;
const MAX_ZOOM = 32;

export default function MmiMap({
  groups,
  detailed,
  selectedCountry,
  selectedGroupId,
  language,
  t,
  onSelectGroup,
}: Props) {
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([WIDTH / 2, HEIGHT / 2]);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [svgWidth, setSvgWidth] = useState(WIDTH);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<DragState | null>(null);
  const pointers = useRef<Map<number, PointerPoint>>(new Map());
  const pinch = useRef<PinchState | null>(null);
  const hoverHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch("/mmi-data/world-countries.geojson")
      .then((response) => response.json() as Promise<GeoJson>)
      .then((geoJson) => {
        if (mounted) {
          setFeatures(geoJson.features.filter((feature) => feature.geometry));
        }
      })
      .catch((error) => {
        console.error("Unable to load world map", error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const updateSize = () => {
      const width = svg.getBoundingClientRect().width;
      if (width > 0) {
        setSvgWidth(width);
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(svg);

    return () => {
      observer.disconnect();
    };
  }, []);

  const paths = useMemo(
    () =>
      features
        .map((feature, index) => ({
          id: `${getFeatureName(feature) || "country"}-${index}`,
          name: getFeatureName(feature),
          d: feature.geometry ? geometryToPath(feature.geometry) : "",
        }))
        .filter((path) => path.d),
    [features],
  );

  const viewWidth = WIDTH / zoom;
  const viewHeight = HEIGHT / zoom;
  const clampedCenter = clampCenter(center, viewWidth, viewHeight);
  const viewX = clamp(clampedCenter[0] - viewWidth / 2, 0, WIDTH - viewWidth);
  const viewY = clamp(clampedCenter[1] - viewHeight / 2, 0, HEIGHT - viewHeight);
  const pixelsPerSvgUnit = Math.max(svgWidth / viewWidth, 0.001);
  const isCompactMap = svgWidth < 560;
  const singleMarkerRadius = screenPixelsToSvgUnits(
    isCompactMap ? 11 : 9.5,
    pixelsPerSvgUnit,
  );
  const clusterMarkerRadius = screenPixelsToSvgUnits(
    isCompactMap ? 15 : 13,
    pixelsPerSvgUnit,
  );
  const fontSize = screenPixelsToSvgUnits(isCompactMap ? 11 : 10, pixelsPerSvgUnit);
  const hitAreaRadius = screenPixelsToSvgUnits(isCompactMap ? 24 : 18, pixelsPerSvgUnit);
  const markerPositions = useMemo(
    () => buildMarkerPositions(groups),
    [groups],
  );
  const hoveredGroup = groups.find((group) => group.id === hoveredGroupId) ?? null;
  const hoveredPosition = hoveredGroup
    ? markerPositions.get(hoveredGroup.id) ?? project(hoveredGroup.longitude, hoveredGroup.latitude)
    : null;

  function changeZoom(delta: number) {
    setZoom((value) => clamp(value + delta, MIN_ZOOM, MAX_ZOOM));
  }

  function showHover(groupId: string) {
    if (hoverHideTimer.current) {
      clearTimeout(hoverHideTimer.current);
      hoverHideTimer.current = null;
    }
    setHoveredGroupId(groupId);
  }

  function hideHover(groupId: string) {
    if (hoverHideTimer.current) {
      clearTimeout(hoverHideTimer.current);
    }
    hoverHideTimer.current = setTimeout(() => {
      setHoveredGroupId((current) => (current === groupId ? null : current));
    }, 120);
  }

  function resetView() {
    setZoom(1);
    setCenter([WIDTH / 2, HEIGHT / 2]);
  }

  return (
    <div
      className={`mmi-map mmi-svg-map ${detailed ? "detailed" : ""}`}
      aria-label="MMI references world map"
      onWheel={(event) => {
        event.preventDefault();
        changeZoom(event.deltaY < 0 ? 1.25 : -1.25);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 && event.button !== 1) {
          return;
        }

        const target = event.target as Element;
        const startsOnMarker = Boolean(target.closest(".mmi-svg-marker"));
        if (target.closest(".mmi-zoom-controls") || (startsOnMarker && event.pointerType !== "touch")) {
          return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointers.current.size >= 2) {
          const bounds = event.currentTarget.getBoundingClientRect();
          const activePointers = [...pointers.current.values()].slice(-2);
          pinch.current = createPinchState(
            activePointers,
            bounds,
            zoom,
            clampedCenter,
          );
          drag.current = null;
          return;
        }

        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          center: clampedCenter,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) {
          return;
        }

        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const bounds = event.currentTarget.getBoundingClientRect();

        if (pointers.current.size >= 2 && pinch.current) {
          event.preventDefault();
          const activePointers = [...pointers.current.values()].slice(-2);
          const nextDistance = getDistance(activePointers);
          const nextZoom = clamp(
            pinch.current.zoom * (nextDistance / Math.max(pinch.current.distance, 1)),
            MIN_ZOOM,
            MAX_ZOOM,
          );
          const midpoint = getMidpoint(activePointers);
          const nextViewWidth = WIDTH / nextZoom;
          const nextViewHeight = HEIGHT / nextZoom;
          const nextCenter: [number, number] = [
            pinch.current.mapPoint[0] -
              ((midpoint.x - bounds.left) / bounds.width) * nextViewWidth +
              nextViewWidth / 2,
            pinch.current.mapPoint[1] -
              ((midpoint.y - bounds.top) / bounds.height) * nextViewHeight +
              nextViewHeight / 2,
          ];

          setZoom(nextZoom);
          setCenter(clampCenter(nextCenter, nextViewWidth, nextViewHeight));
          return;
        }

        if (!drag.current || drag.current.pointerId !== event.pointerId) {
          return;
        }

        const deltaX = ((event.clientX - drag.current.startX) / bounds.width) * viewWidth;
        const deltaY = ((event.clientY - drag.current.startY) / bounds.height) * viewHeight;
        if (Math.abs(event.clientX - drag.current.startX) > 3 || Math.abs(event.clientY - drag.current.startY) > 3) {
          drag.current.moved = true;
        }
        setCenter(
          clampCenter(
            [drag.current.center[0] - deltaX, drag.current.center[1] - deltaY],
            viewWidth,
            viewHeight,
          ),
        );
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        pinch.current = null;
        if (drag.current?.pointerId === event.pointerId) {
          drag.current = null;
        }
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        pinch.current = null;
        drag.current = null;
      }}
      onPointerLeave={(event) => {
        if (pointers.current.has(event.pointerId)) {
          pointers.current.delete(event.pointerId);
          pinch.current = null;
        }
        if (drag.current?.pointerId === event.pointerId) {
          drag.current = null;
        }
      }}
      onAuxClick={(event) => {
        event.preventDefault();
      }}
    >
      <div
        className="mmi-zoom-controls"
        aria-label="Map zoom controls"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            changeZoom(2);
          }}
          aria-label={t.zoomIn}
        >
          +
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            changeZoom(-2);
          }}
          aria-label={t.zoomOut}
        >
          -
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            resetView();
          }}
        >
          {t.zoomReset}
        </button>
      </div>
      <svg ref={svgRef} viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`} role="img">
        <rect width={WIDTH} height={HEIGHT} className="mmi-map-ocean" />
        <g className="mmi-map-countries">
          {paths.map((path) => (
            <path key={path.id} d={path.d} aria-label={path.name} />
          ))}
        </g>
        <g className="mmi-map-markers">
          {groups.map((group) => {
            const [x, y] = markerPositions.get(group.id) ?? project(group.longitude, group.latitude);
            const isSelected =
              selectedGroupId === group.id ||
              (!selectedGroupId && selectedCountry === group.country && !detailed);
            const isCluster = group.projects.length > 1;
            const markerRadius = isCluster ? clusterMarkerRadius : singleMarkerRadius;
            const label =
              !isCluster
                ? group.projects[0].title
                : `${group.label}: ${group.projects.length} projects`;

            return (
              <g
                key={group.id}
                className={`mmi-svg-marker ${isSelected ? "selected" : ""}`}
                style={
                  {
                    "--marker-color": group.color,
                    "--marker-radius": markerRadius,
                    "--marker-font-size": fontSize,
                  } as React.CSSProperties
                }
                transform={`translate(${x} ${y})`}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") {
                    showHover(group.id);
                  }
                }}
                onPointerLeave={() => {
                  hideHover(group.id);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  showHover(group.id);
                  onSelectGroup(group);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    showHover(group.id);
                    onSelectGroup(group);
                  }
                }}
                onFocus={() => showHover(group.id)}
                onBlur={() => {
                  hideHover(group.id);
                }}
                role="button"
                tabIndex={0}
                aria-label={label}
              >
                <circle className="mmi-svg-marker-hit-area" r={Math.max(markerRadius * 1.65, hitAreaRadius)} />
                <circle r={markerRadius} />
                {isCluster ? (
                  <text fontSize={fontSize} dy={fontSize * 0.32}>
                    {group.projects.length}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      {hoveredGroup && hoveredPosition ? (
        <MapHoverCard
          group={hoveredGroup}
          language={language}
          left={`${clamp(((hoveredPosition[0] - viewX) / viewWidth) * 100, 4, 76)}%`}
          top={`${clamp(((hoveredPosition[1] - viewY) / viewHeight) * 100, 8, 76)}%`}
        />
      ) : null}
    </div>
  );
}

function MapHoverCard({
  group,
  language,
  left,
  top,
}: {
  group: CountryProjectGroup;
  language: Language;
  left: string;
  top: string;
}) {
  if (group.projects.length === 1) {
    const projectItem = group.projects[0];
    const description = getProjectDescription(projectItem, language);
    const thumbnail = projectItem.images.find((image) => image.local_path)?.local_path;

    return (
      <aside className="mmi-map-hover-card single" style={{ left, top }}>
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt={projectItem.images[0]?.alt ?? projectItem.title} />
        ) : null}
        <div>
          <strong>{getProjectTitle(projectItem, language)}</strong>
          {description ? <p>{shorten(description, 150)}</p> : null}
        </div>
      </aside>
    );
  }

  const groupedProjects = groupProjectsByCategory(group.projects);

  return (
    <aside className="mmi-map-hover-card cluster" style={{ left, top }}>
      <strong>
        {group.label} · {group.projects.length}
      </strong>
      <div>
        {groupedProjects.map(([category, projects]) => (
          <section key={category}>
            <span>{getCategoryLabel(category, language)}</span>
            <ul>
              {projects.slice(0, 5).map((projectItem) => (
                <li key={projectItem.id}>{getProjectTitle(projectItem, language)}</li>
              ))}
              {projects.length > 5 ? <li>+{projects.length - 5}</li> : null}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}

function geometryToPath(geometry: Geometry): string {
  if (geometry.type === "Polygon") {
    return polygonToPath(geometry.coordinates as number[][][]);
  }

  return (geometry.coordinates as number[][][][])
    .map((polygon) => polygonToPath(polygon))
    .join(" ");
}

function getFeatureName(feature: GeoFeature): string {
  return (
    feature.properties?.name ??
    feature.properties?.NAME_LONG ??
    feature.properties?.ADMIN ??
    feature.properties?.NAME ??
    ""
  );
}

function polygonToPath(polygon: number[][][]): string {
  return polygon
    .flatMap((ring) => splitRingAtDateLine(ring))
    .filter((ring) => ring.length >= 3)
    .map((ring) => {
      const commands = ring.map(([longitude, latitude], index) => {
        const [x, y] = project(longitude, latitude);
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      });
      return `${commands.join(" ")} Z`;
    })
    .join(" ");
}

function project(longitude: number, latitude: number): [number, number] {
  const clampedLatitude = Math.max(MIN_LAT, Math.min(MAX_LAT, latitude));
  const x = ((longitude + 180) / 360) * WIDTH;
  const maxMercator = mercatorY(MAX_LAT);
  const minMercator = mercatorY(MIN_LAT);
  const y =
    ((maxMercator - mercatorY(clampedLatitude)) / (maxMercator - minMercator)) *
    HEIGHT;
  return [x, y];
}

function splitRingAtDateLine(ring: number[][]): number[][][] {
  const segments: number[][][] = [];
  let segment: number[][] = [];

  for (const point of ring) {
    const previous = segment[segment.length - 1];
    if (previous && Math.abs(point[0] - previous[0]) > 180) {
      if (segment.length >= 3) {
        segments.push(segment);
      }
      segment = [point];
    } else {
      segment.push(point);
    }
  }

  if (segment.length >= 3) {
    segments.push(segment);
  }

  return segments;
}

function mercatorY(latitude: number): number {
  const radians = (latitude * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function buildMarkerPositions(groups: CountryProjectGroup[]): Map<string, [number, number]> {
  return new Map(
    groups.map((group) => [group.id, project(group.longitude, group.latitude)] as const),
  );
}

function createPinchState(
  points: PointerPoint[],
  bounds: DOMRect,
  zoom: number,
  center: [number, number],
): PinchState {
  const viewWidth = WIDTH / zoom;
  const viewHeight = HEIGHT / zoom;
  const viewX = clamp(center[0] - viewWidth / 2, 0, WIDTH - viewWidth);
  const viewY = clamp(center[1] - viewHeight / 2, 0, HEIGHT - viewHeight);
  const midpoint = getMidpoint(points);
  const mapPoint: [number, number] = [
    viewX + ((midpoint.x - bounds.left) / bounds.width) * viewWidth,
    viewY + ((midpoint.y - bounds.top) / bounds.height) * viewHeight,
  ];

  return {
    distance: getDistance(points),
    zoom,
    mapPoint,
  };
}

function getDistance(points: PointerPoint[]): number {
  if (points.length < 2) {
    return 1;
  }

  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function getMidpoint(points: PointerPoint[]): PointerPoint {
  if (points.length < 2) {
    return points[0] ?? { x: 0, y: 0 };
  }

  return {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  };
}

function screenPixelsToSvgUnits(pixels: number, pixelsPerSvgUnit: number): number {
  return pixels / pixelsPerSvgUnit;
}

function groupProjectsByCategory(projects: MmiProject[]): Array<[MmiProject["category_primary"], MmiProject[]]> {
  const groups = new Map<MmiProject["category_primary"], MmiProject[]>();
  for (const projectItem of projects) {
    groups.set(projectItem.category_primary, [
      ...(groups.get(projectItem.category_primary) ?? []),
      projectItem,
    ]);
  }

  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function shorten(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1).trim()}...` : compact;
}

function clampCenter(center: [number, number], viewWidth: number, viewHeight: number): [number, number] {
  return [
    clamp(center[0], viewWidth / 2, WIDTH - viewWidth / 2),
    clamp(center[1], viewHeight / 2, HEIGHT - viewHeight / 2),
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
