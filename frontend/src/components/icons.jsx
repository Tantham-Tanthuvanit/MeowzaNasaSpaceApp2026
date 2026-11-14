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
