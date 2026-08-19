import { useState } from 'react';
import { getProfileUrl } from '../../services/api';
import { PROJECT_CATEGORIES, LINK_TYPES } from '../../utils/profileCompletion';
import { IconClose } from '../icons/Icons';

const normalizeUrl = (url) => {
  if (!url?.trim()) return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const categoryLabel = (value) => PROJECT_CATEGORIES.find((c) => c.value === value)?.label || value;
const linkLabel = (type) => LINK_TYPES.find((l) => l.value === type)?.label || 'Link';

const fileName = (path) => (path ? path.split('/').pop() : 'File');

const isImagePath = (path) => /\.(png|jpe?g|gif|webp|svg)$/i.test(path || '');

export default function PortfolioProjectPreview({ project, onClose }) {
  const [lightbox, setLightbox] = useState('');

  if (!project) return null;

  const images = [
    ...(project.thumbnail ? [project.thumbnail] : []),
    ...(project.screenshots || []).filter((s) => s !== project.thumbnail),
  ];
  const hero = images[0] || '';

  return (
    <div className="portfolio-preview-backdrop" onClick={onClose} role="presentation">
      <div className="portfolio-preview" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="portfolio-preview-title">
        <button type="button" className="portfolio-preview__close" onClick={onClose} aria-label="Close preview">
          <IconClose size={18} />
        </button>

        {hero ? (
          <div className="portfolio-preview__hero">
            <img src={getProfileUrl(hero)} alt="" />
          </div>
        ) : (
          <div className="portfolio-preview__hero portfolio-preview__hero--empty">
            <span>{categoryLabel(project.category)?.[0] || 'P'}</span>
          </div>
        )}

        <div className="portfolio-preview__body">
          <div className="portfolio-preview__head">
            <span className="portfolio-preview__cat">{categoryLabel(project.category)}</span>
            {project.completionDate && (
              <span className="portfolio-preview__date">
                Completed {new Date(project.completionDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          <h2 id="portfolio-preview-title">{project.title}</h2>

          {project.description && <p className="portfolio-preview__desc">{project.description}</p>}

          {(project.technologies || []).length > 0 && (
            <section className="portfolio-preview__block">
              <h3>Technologies</h3>
              <div className="portfolio-preview__tags">
                {project.technologies.map((t) => <span key={t}>{t}</span>)}
              </div>
            </section>
          )}

          {(project.links || []).length > 0 && (
            <section className="portfolio-preview__block">
              <h3>Links</h3>
              <div className="portfolio-preview__links">
                {project.links.map((link, i) => (
                  <a
                    key={`${link.type}-${i}`}
                    href={normalizeUrl(link.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="portfolio-preview__link"
                  >
                    <span className="portfolio-preview__link-type">{linkLabel(link.type)}</span>
                    <span className="portfolio-preview__link-url">{link.url}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {images.length > 1 && (
            <section className="portfolio-preview__block">
              <h3>Screenshots</h3>
              <div className="portfolio-preview__gallery">
                {images.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    type="button"
                    className="portfolio-preview__thumb"
                    onClick={() => setLightbox(src)}
                    aria-label={`View screenshot ${i + 1}`}
                  >
                    <img src={getProfileUrl(src)} alt="" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {(project.files || []).length > 0 && (
            <section className="portfolio-preview__block">
              <h3>Files</h3>
              <ul className="portfolio-preview__files">
                {project.files.map((file, i) => (
                  <li key={`${file}-${i}`}>
                    <a href={getProfileUrl(file)} target="_blank" rel="noopener noreferrer" download>
                      {isImagePath(file) ? 'View image' : 'Download'} · {fileName(file)}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="portfolio-preview-lightbox" onClick={() => setLightbox('')} role="presentation">
          <button type="button" className="portfolio-preview-lightbox__close" onClick={() => setLightbox('')} aria-label="Close image">
            <IconClose size={20} />
          </button>
          <img src={getProfileUrl(lightbox)} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
