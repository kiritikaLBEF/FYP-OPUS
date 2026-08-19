export const AD_ANIMATION_OPTIONS = [
  { value: 'fade', label: 'Fade in', hint: 'Soft fade of the photo and copy' },
  { value: 'slide', label: 'Slide across', hint: 'Photo and text enter from opposite sides' },
  { value: 'kenburns', label: 'Slow pan', hint: 'Gentle zoom and pan across the photo' },
  { value: 'zoom', label: 'Zoom in', hint: 'Photo eases in from a closer crop' },
  { value: 'rise', label: 'Rise up', hint: 'Copy lifts into place over a fading photo' },
];

export default function AdSlide({
  ad,
  imageSrc = '',
  animation = 'fade',
  preview = false,
  children,
}) {
  const anim = AD_ANIMATION_OPTIONS.some((opt) => opt.value === animation)
    ? animation
    : 'fade';
  const title = ad?.title || (preview ? 'Banner title' : '');
  const subtitle = ad?.subtitle || '';
  const org = ad?.organizationName || '';
  const ctaLabel = ad?.ctaLabel || 'Learn more';
  const ctaUrl = ad?.ctaUrl || '';

  return (
    <div className={`home-ad home-ad--anim-${anim}${preview ? ' home-ad--preview' : ''}`}>
      {imageSrc ? (
        <div className="home-ad__media">
          <img className="home-ad__image" src={imageSrc} alt="" />
        </div>
      ) : (
        <div className="home-ad__media">
          <div className="home-ad__image home-ad__image--empty" />
        </div>
      )}
      <div className="home-ad__body">
        {org ? <p className="home-ad__org">{org}</p> : null}
        {title ? <h3 className="home-ad__title">{title}</h3> : null}
        {subtitle ? <p className="home-ad__sub">{subtitle}</p> : null}
        {preview || !ctaUrl ? (
          <span className="opus-btn opus-btn--primary home-ad__cta">{ctaLabel || 'Learn more'}</span>
        ) : (
          <a className="opus-btn opus-btn--primary home-ad__cta" href={ctaUrl} target="_blank" rel="noreferrer">
            {ctaLabel || 'Learn more'}
          </a>
        )}
      </div>
      {children}
    </div>
  );
}
