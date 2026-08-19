const GLYPHS = {
  top_performer: 'M36 22l4.2 8.6 9.5 1.4-6.9 6.7 1.6 9.4L36 43.6l-8.4 4.5 1.6-9.4-6.9-6.7 9.5-1.4L36 22z',
  rising_talent: 'M36 20l12 14h-7v16H31V34h-7l12-14z',
  growing: 'M24 52h7V38h-7v14zm9 0h7V32h-7v20zm9 0h7V24h-7v28z',
  top_bidder: '',
  high_potential: 'M36 20l5.2 10.4 11.5 1.7-8.3 8.1 2 11.4L36 45.6l-10.4 5.4 2-11.4-8.3-8.1 11.5-1.7L36 20z',
};

function MedalGlyph({ badgeKey }) {
  if (badgeKey === 'top_bidder') {
    return (
      <>
        <circle cx="36" cy="36" r="11" fill="none" stroke="#fff" strokeWidth="2.2" />
        <circle cx="36" cy="36" r="4.5" fill="#fff" />
      </>
    );
  }
  const d = GLYPHS[badgeKey] || 'M36 20l12 6v12c0 8.5-5.4 14.6-12 17.4C29.4 52.6 24 46.5 24 38V26l12-6z';
  return <path d={d} fill="#fff" />;
}

export default function OpusBadge({
  badge,
  size = 'md',
  downloadable = false,
  recipientName = '',
  onDownload,
}) {
  const key = badge?.key || '';
  const color = badge?.color || '#0071e3';
  const label = badge?.label || 'Badge';
  const title = downloadable
    ? `Download ${label} certificate`
    : (badge?.description || label);

  const handleClick = (e) => {
    if (!downloadable) return;
    e.preventDefault();
    e.stopPropagation();
    onDownload?.(badge, recipientName);
  };

  return (
    <span
      className={`opus-badge opus-badge--${size}${downloadable ? ' opus-badge--download' : ''}`}
      title={title}
    >
      {downloadable ? (
        <button type="button" className="opus-badge__hit" onClick={handleClick} aria-label={title}>
          <MedalSvg color={color} badgeKey={key} />
        </button>
      ) : (
        <MedalSvg color={color} badgeKey={key} />
      )}
    </span>
  );
}

function MedalSvg({ color, badgeKey }) {
  return (
    <svg className="opus-badge__svg" viewBox="0 0 72 92" aria-hidden="true">
      <path d="M28 58 L16 86 L30 76 L36 90 L42 76 L56 86 L44 58" fill="#b42318" />
      <path d="M28 58 L36 74 L44 58" fill="#7f1d1d" />
      <circle cx="36" cy="36" r="30" fill="#d6b25e" />
      <circle cx="36" cy="36" r="26" fill="#f3e0a6" />
      <circle cx="36" cy="36" r="22" fill={color} />
      <circle cx="36" cy="36" r="22" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      <MedalGlyph badgeKey={badgeKey} />
    </svg>
  );
}
