const SW = 1.5;

export function IconSun({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth={SW} />
      <path stroke="currentColor" strokeWidth={SW} strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export function IconMoon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconBell({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3a5 5 0 00-5 5v2.5l-1.5 2.5h13L17 10.5V8a5 5 0 00-5-5z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <path d="M10 18a2 2 0 004 0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </svg>
  );
}

export function IconSignIn({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 17l5-5-5-5M15 12H3" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPersonAdd({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth={SW} />
      <path d="M3 20v-1.5a4.5 4.5 0 0 1 4.5-4.5H9" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M16 11v5M18.5 13.5H13.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </svg>
  );
}

export function IconMenu({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </svg>
  );
}

export function IconClose({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </svg>
  );
}

export function IconEye({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth={SW} />
    </svg>
  );
}

export function IconEyeOff({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M10.6 10.6A4 4 0 0 0 12 16a4 4 0 0 0 3.4-1.9M9.9 5.1A10.7 10.7 0 0 1 12 5c6 0 10 7 10 7a18.2 18.2 0 0 1-4.2 5.1M6.1 6.1A18.5 18.5 0 0 0 2 12s4 7 10 7a10.4 10.4 0 0 0 4.9-1.2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBriefcase({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="8" width="18" height="12" rx="2" stroke="currentColor" strokeWidth={SW} />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </svg>
  );
}

export function IconForum({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-1.9 5.4 8.5 8.5 0 0 1-6.6 3.1 8.4 8.4 0 0 1-3.9-1L3 21l1.9-5.6A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconShield({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.5-3.2 8.7-7 9.8C8.2 20.7 5 16.5 5 12V6l7-3z" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
