const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const CloseIcon = () => (
  <svg width="14" height="14" strokeWidth="2.4" {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const PlusIcon = () => (
  <svg width="16" height="16" strokeWidth="2.4" {...base}><path d="M12 5v14M5 12h14" /></svg>
);
export const CheckIcon = () => (
  <svg width="12" height="12" strokeWidth="3" {...base}><path d="M5 12l5 5 9-10" /></svg>
);
export const PrevIcon = () => (
  <svg width="18" height="18" strokeWidth="2" {...base}><path d="M15 6l-6 6 6 6" /></svg>
);
export const NextIcon = () => (
  <svg width="18" height="18" strokeWidth="2" {...base}><path d="M9 6l6 6-6 6" /></svg>
);
export const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg>
);
export const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
export const InfoIcon = () => (
  <svg width="22" height="22" strokeWidth="2" {...base}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></svg>
);
export const ShuffleIcon = () => (
  <svg width="16" height="16" strokeWidth="2.2" {...base}>
    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
);
export const CompassIcon = () => (
  <svg width="16" height="16" strokeWidth="2.2" {...base}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5" fill="currentColor" stroke="none" />
  </svg>
);
export const BookIcon = () => (
  <svg width="16" height="16" strokeWidth="2.2" {...base}>
    <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
  </svg>
);
export const FlameIcon = () => (
  <svg width="15" height="15" strokeWidth="2.2" {...base}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" />
  </svg>
);
export const SunIcon = () => (
  <svg width="16" height="16" strokeWidth="2.2" {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
export const MoonIcon = () => (
  <svg width="16" height="16" strokeWidth="2.2" {...base}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
export const PaletteIcon = () => (
  <svg width="16" height="16" strokeWidth="2.2" {...base}>
    <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="6.5" cy="12.5" r="1.5" fill="currentColor" stroke="none" />
    <path d="M12 2C6.49 2 2 6.49 2 12c0 4.41 3.59 8 8 8 1.1 0 2-.9 2-2 0-.46-.17-.89-.44-1.24-.26-.33-.44-.75-.44-1.22 0-1.1.9-2 2-2h1.66c4.54 0 7.78-3.6 7.78-8.14C23 6.08 18.06 2 12 2z" />
  </svg>
);
export const SettingsIcon = () => (
  <svg width="16" height="16" strokeWidth="2.2" {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
