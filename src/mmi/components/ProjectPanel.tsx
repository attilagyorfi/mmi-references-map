"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import {
  getCategoryLabel,
  getProjectDescription,
  getProjectLocation,
  getProjectTitle,
  getProjectWorkType,
  type Dictionary,
} from "@/mmi/i18n";
import type {
  CategoryDefinition,
  CountryProjectGroup,
  Language,
  MmiProject,
} from "@/mmi/types";

type Props = {
  categories: CategoryDefinition[];
  group: CountryProjectGroup | null;
  project: MmiProject | null;
  language: Language;
  t: Dictionary;
  onSelectProject: (project: MmiProject) => void;
};

export default function ProjectPanel({
  categories,
  group,
  project,
  language,
  t,
  onSelectProject,
}: Props) {
  const [imageIndex, setImageIndex] = useState(0);
  const category = useMemo(
    () => categories.find((item) => item.id === project?.category_primary),
    [categories, project?.category_primary],
  );

  if (!group) {
    return (
      <aside className="mmi-panel mmi-empty-panel">
        <p>{t.selectPrompt}</p>
      </aside>
    );
  }

  if (!project) {
    return (
      <aside className="mmi-panel">
        <p className="mmi-eyebrow">{t.selectedCountry}</p>
        <h2>{group.label}</h2>
        <p className="mmi-panel-count">
          {group.projects.length} {t.projects}
        </p>
        <div className="mmi-project-list">
          {group.projects.map((item) => (
            <button key={item.id} type="button" onClick={() => onSelectProject(item)}>
              <span style={{ background: item.category_color }} />
              <strong>{getProjectTitle(item, language)}</strong>
              <small>{item.year_label ?? item.location_text ?? item.category_primary}</small>
            </button>
          ))}
        </div>
      </aside>
    );
  }

  const description = getProjectDescription(project, language);
  const activeImage = project.images[imageIndex % Math.max(project.images.length, 1)];

  return (
    <aside className="mmi-panel">
      <p className="mmi-eyebrow">{getProjectLocation(project, language) ?? project.country}</p>
      <h2>{getProjectTitle(project, language)}</h2>
      <div className="mmi-meta-row">
        <span style={{ background: project.category_color }}>
          {category ? getCategoryLabel(category.id, language) : project.category_primary}
        </span>
        {project.year_label ? <span>{project.year_label}</span> : null}
      </div>

      <ProjectFact label={t.location} value={getProjectLocation(project, language)} />
      <ProjectFact label={t.workType} value={getProjectWorkType(project, language)} />
      <ProjectFact label={t.investor} value={project.investor} />
      <ProjectFact label={t.client} value={project.client} />
      <ProjectFact label={t.contractor} value={project.contractor} />
      <ProjectFact label={t.projectManager} value={project.project_manager} />

      {description ? <p className="mmi-description">{description}</p> : null}

      <section className="mmi-gallery">
        <div className="mmi-gallery-header">
          <h3>{t.images}</h3>
          {project.images.length > 1 ? (
            <div>
              <button
                type="button"
                onClick={() =>
                  setImageIndex((current) =>
                    current === 0 ? project.images.length - 1 : current - 1,
                  )
                }
              >
                {t.previousImage}
              </button>
              <button
                type="button"
                onClick={() =>
                  setImageIndex((current) => (current + 1) % project.images.length)
                }
              >
                {t.nextImage}
              </button>
            </div>
          ) : null}
        </div>
        {activeImage?.local_path ? (
          <Image
            src={activeImage.local_path}
            alt={activeImage.alt}
            width={820}
            height={615}
          />
        ) : (
          <p>{t.noImages}</p>
        )}
      </section>

      <a className="mmi-source-link" href={project.source_url} target="_blank" rel="noreferrer">
        {t.source}
      </a>
    </aside>
  );
}

function ProjectFact({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <dl className="mmi-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </dl>
  );
}
