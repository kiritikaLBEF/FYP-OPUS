const SW = 1.5;

function Icon({ children, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconPersonal() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth={SW} />
      <path d="M5 20v-1a5 5 0 0 1 10 0v1" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </Icon>
  );
}

export function IconProfessional() {
  return (
    <Icon>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth={SW} />
      <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </Icon>
  );
}

export function IconSkills() {
  return (
    <Icon>
      <path d="M12 2l2.4 4.8 5.4.8-3.9 3.8.9 5.3L12 14.2 7.2 16.7l.9-5.3L4.2 7.6l5.4-.8L12 2z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
    </Icon>
  );
}

export function IconCertifications() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={SW} />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

export function IconProjects() {
  return (
    <Icon>
      <rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" strokeWidth={SW} />
      <path d="M3 11h18M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </Icon>
  );
}

export function IconPreferences() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={SW} />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </Icon>
  );
}

export function IconPrivacy() {
  return (
    <Icon>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth={SW} />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </Icon>
  );
}

export function IconAccount() {
  return (
    <Icon>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth={SW} />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth={1.2} />
    </Icon>
  );
}
