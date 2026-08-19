const SW = 1.5;

function Icon({ children }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
  );
}

export const SECTION_ICONS = {
  overview: () => (
    <Icon><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={SW} /><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={SW} /><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={SW} /><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={SW} /></Icon>
  ),
  analytics: () => (
    <Icon><path d="M4 19V5M4 19h16M8 17V11M12 17V7M16 17v-4" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" /></Icon>
  ),
  earnings: () => (
    <Icon><rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth={SW} /><path d="M3 10h18M7 15h4" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" /></Icon>
  ),
  projects: () => (
    <Icon><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" strokeWidth={SW} /><rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth={SW} /></Icon>
  ),
  transactions: () => (
    <Icon><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" /></Icon>
  ),
  estatement: () => (
    <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth={SW} /><path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" /></Icon>
  ),
};
