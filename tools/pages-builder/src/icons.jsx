// Inserter icons — one per block type, so the element library reads like a real
// palette (Avada-style). Simple 24px line glyphs in currentColor.
const S = (children) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export const ICONS = {
  container: S(<rect x="3" y="4" width="18" height="16" rx="1.5" />),
  columns: S(<><rect x="3" y="4" width="7.5" height="16" rx="1" /><rect x="13.5" y="4" width="7.5" height="16" rx="1" /></>),
  'el-spacer': S(<><path d="M4 9h16" /><path d="M4 15h16" /><path d="M12 5v3M12 16v3" /></>),
  'section-heading': S(<><path d="M4 6h16" /><path d="M12 6v13" /></>),
  'el-heading': S(<><path d="M6 5v14M18 5v14M6 12h12" /></>),
  'rich-text': S(<><path d="M4 6h16M4 10h16M4 14h11M4 18h13" /></>),
  'el-text': S(<><path d="M5 8h14M5 12h14M5 16h9" /></>),
  'el-button': S(<><rect x="3" y="8" width="18" height="8" rx="4" /><path d="M14 12h3" /></>),
  'el-image': S(<><rect x="3" y="4" width="18" height="16" rx="1.5" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>),
  'el-split': S(<><rect x="3" y="5" width="8" height="14" rx="1" /><path d="M14 8h7M14 12h7M14 16h4" /></>),
  'el-stats': S(<><path d="M5 19V11M12 19V5M19 19v-6" /></>),
  'el-testimonial': S(<><path d="M9 8H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v3l3-3V10a2 2 0 0 0-1-2Z" /><path d="M20 8h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v3" /></>),
  'el-logos': S(<><rect x="3" y="6" width="5" height="4" rx="1" /><rect x="10" y="6" width="5" height="4" rx="1" /><rect x="17" y="6" width="4" height="4" rx="1" /><path d="M4 15h16" /></>),
  'el-features': S(<><rect x="3" y="4" width="7" height="7" rx="1" /><rect x="14" y="4" width="7" height="7" rx="1" /><rect x="3" y="13" width="7" height="7" rx="1" /><rect x="14" y="13" width="7" height="7" rx="1" /></>),
  cta: S(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>),
  faq: S(<><path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" /><path d="M9.5 9a2.5 2.5 0 1 1 3 2.4V13" /><path d="M12 16h.01" /></>),
  'raw-html': S(<><path d="m8 6-5 6 5 6M16 6l5 6-5 6" /></>),
};
