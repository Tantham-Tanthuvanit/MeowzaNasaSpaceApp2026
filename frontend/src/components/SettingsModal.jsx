import { useState, useEffect } from 'react';
import { THEMES, getTheme, DEFAULT_THEME_ID } from '../core/themes';
import { CloseIcon, CheckIcon, ShuffleIcon, PaletteIcon, BookIcon } from './icons';

const TABS = [
  { id: 'themes', label: 'Themes', icon: PaletteIcon },
  { id: 'shortcuts', label: 'Keyboard & Controls', icon: BookIcon },
];

export default function SettingsModal({
  currentThemeId,
  onSelectTheme,
  onClose,
  initialTab = 'themes',
}) {
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'dark' | 'light'

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const currentTheme = getTheme(currentThemeId);

  // Filter themes based on search and type
  const q = search.trim().toLowerCase();
  const filteredThemes = THEMES.filter((t) => {
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.featured && t.featured.toLowerCase().includes(q));
    return matchesType && matchesSearch;
  });

  const pickRandomTheme = () => {
    const pool = THEMES.filter((t) => t.id !== currentThemeId);
    if (!pool.length) return;
    const random = pool[Math.floor(Math.random() * pool.length)];
    onSelectTheme(random.id);
  };

  const counts = {
    all: THEMES.length,
    dark: THEMES.filter((t) => t.type === 'dark').length,
    light: THEMES.filter((t) => t.type === 'light').length,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(11,16,32,0.65)] p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="m-auto flex max-h-[92vh] w-full max-w-[880px] flex-col overflow-hidden rounded-3xl border border-soft bg-surface text-ink shadow-2xl"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-soft bg-page/50 px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-1">
            <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-rust">
              <PaletteIcon />
              UI Settings & Appearance
            </span>
            <h2 id="settings-modal-title" className="font-display text-[24px] font-medium leading-tight sm:text-[28px]">
              Theme &amp; Preferences
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="btn-round shrink-0"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Tab Navigation */}
        <div role="tablist" aria-label="Settings sections" className="flex flex-wrap gap-2 border-b border-soft bg-page px-6 py-3 sm:px-8">
          {TABS.map((t) => {
            const active = t.id === tab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-ink font-semibold text-white dark:text-[#0B1020]'
                    : 'border border-line bg-surface text-body hover:border-ink hover:text-ink'
                }`}
              >
                <Icon />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {tab === 'themes' && (
            <div className="flex flex-col gap-6">
              {/* Active Theme Spotlight Card */}
              <div className="flex flex-col gap-3 rounded-2xl border border-soft bg-page p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">Active Theme</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    <span className="font-display text-lg font-bold text-ink">{currentTheme.name}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                        currentTheme.type === 'dark'
                          ? 'bg-[#1E294A] text-[#93C5FD]'
                          : 'bg-[#FFF1E6] text-[#B4460F]'
                      }`}
                    >
                      {currentTheme.type}
                    </span>
                    {currentTheme.featured && (
                      <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-[#0B1020]">
                        {currentTheme.featured}
                      </span>
                    )}
                  </div>
                  {currentTheme.sourceUrl && (
                    <a
                      href={currentTheme.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-rust hover:underline"
                    >
                      View on Coolors.co ↗
                    </a>
                  )}
                </div>

                <p className="text-sm leading-relaxed text-body">{currentTheme.description}</p>

                {/* Monkeytype Style 5-Color Swatch Preview Bar */}
                <div className="flex flex-col gap-1 pt-1">
                  <div className="flex h-7 w-full overflow-hidden rounded-xl border border-line shadow-inner">
                    {currentTheme.palette.map((color, idx) => (
                      <div
                        key={idx}
                        className="group relative flex flex-1 items-center justify-center transition-all hover:flex-[1.5]"
                        style={{ backgroundColor: color }}
                        title={`Color ${idx + 1}: ${color}`}
                      >
                        <span className="font-mono text-[10px] font-bold opacity-0 transition-opacity group-hover:opacity-100 [text-shadow:0_0_3px_#000,0_0_6px_#000] text-white">
                          {color}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 text-center font-mono text-[10px] text-muted">
                    <span>Background</span>
                    <span>Surface</span>
                    <span>Text</span>
                    <span>Subtext</span>
                    <span>Accent</span>
                  </div>
                </div>
              </div>

              {/* Theme Toolbar: Search, Filters, Randomize */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search themes (e.g. spruce, sunset, nord)..."
                    className="field h-10 min-w-[200px] flex-1 rounded-full px-4 text-sm"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="text-xs text-muted hover:text-ink underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(['all', 'dark', 'light']).map((filterType) => (
                    <button
                      key={filterType}
                      type="button"
                      onClick={() => setTypeFilter(filterType)}
                      className={`h-8 rounded-full px-3 text-xs font-semibold capitalize transition-colors ${
                        typeFilter === filterType
                          ? 'bg-ink text-white dark:text-[#0B1020]'
                          : 'border border-line bg-surface text-body hover:border-ink'
                      }`}
                    >
                      {filterType} ({counts[filterType]})
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={pickRandomTheme}
                    className="btn-plain h-8 px-3 text-xs"
                    title="Switch to a random theme (Monkeytype style)"
                  >
                    <ShuffleIcon />
                    Random
                  </button>
                </div>
              </div>

              {/* Theme Cards Grid */}
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredThemes.map((t) => {
                  const isActive = t.id === currentThemeId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTheme(t.id)}
                      aria-pressed={isActive}
                      className={`group flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all ${
                        isActive
                          ? 'border-accent bg-surface ring-2 ring-accent/60 shadow-md'
                          : 'border-soft bg-surface hover:border-ink hover:shadow-sm'
                      }`}
                    >
                      {/* Card Title & Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-display text-[15px] font-semibold text-ink">
                            {t.name}
                          </span>
                          <span className="text-[12px] text-muted">
                            {t.type === 'dark' ? 'Dark theme' : 'Light theme'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {t.featured && (
                            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-ink">
                              {t.featured}
                            </span>
                          )}
                          {isActive && (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[#0B1020]">
                              <CheckIcon />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Monkeytype 5-color Swatch Bar */}
                      <div className="flex h-4 w-full overflow-hidden rounded-full border border-line">
                        {t.palette.map((c, i) => (
                          <div
                            key={i}
                            className="h-full flex-1"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>

                      {/* Miniature UI Mockup Preview */}
                      <div
                        className="flex h-16 w-full flex-col justify-between rounded-xl p-2.5 transition-transform group-hover:scale-[1.02]"
                        style={{ backgroundColor: t.vars['--color-page'] }}
                      >
                        <div
                          className="flex items-center justify-between rounded-md px-2 py-1"
                          style={{ backgroundColor: t.vars['--color-surface'] }}
                        >
                          <span
                            className="font-mono text-[10px] font-bold"
                            style={{ color: t.vars['--color-ink'] }}
                          >
                            SkyFlip
                          </span>
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: t.vars['--color-accent'] }}
                          />
                        </div>

                        <div className="flex items-center justify-between px-1">
                          <span
                            className="text-[9px]"
                            style={{ color: t.vars['--color-muted'] }}
                          >
                            102 Infrared Bands
                          </span>
                          <span
                            className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                            style={{
                              backgroundColor: t.vars['--color-accent'],
                              color: t.vars['--color-accent-text'] || '#000',
                            }}
                          >
                            Live
                          </span>
                        </div>
                      </div>

                      <p className="line-clamp-2 text-[12px] leading-relaxed text-body">
                        {t.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {filteredThemes.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted">
                  <p className="text-base font-semibold">No themes match “{search}”</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setTypeFilter('all');
                    }}
                    className="btn-plain text-xs"
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'shortcuts' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-semibold text-ink">Keyboard Controls</h3>
                <p className="text-sm text-muted">
                  Quick keys to navigate observation visits and telescope views without touching the mouse.
                </p>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {[
                  ['Spacebar', 'Play or pause the flipbook time-series loop'],
                  ['← / → Arrows', 'Step backward or forward one survey epoch'],
                  ['C / c', 'Toggle between Inferno colormap and Grayscale'],
                  ['1 – 6', 'Jump straight to SPHEREx Detector Band 1 through 6'],
                  ['Escape', 'Close any open modal dialog or popup card'],
                  ['Shift + Click', 'Drop a candidate flag marker at coordinates'],
                  ['Mouse Scroll', 'Zoom sky map seamlessly up to 20,000%'],
                  ['FOV Presets', 'Switch between 3′, 5′, 8′, 12′, and 15′ fields of view'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center gap-3 rounded-xl border border-soft bg-page p-3">
                    <kbd className="shrink-0 rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-xs font-semibold text-ink shadow-sm">
                      {key}
                    </kbd>
                    <span className="text-[13px] text-body">{desc}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-soft bg-page p-4 text-[13px] leading-relaxed text-body">
                <strong className="font-semibold text-rust">Pro Tip: </strong>
                In the Sky Viewer, pressing <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-xs">C</kbd> instantly switches between real scientific false-color (Inferno) and high-contrast grayscale so faint asteroids and brown dwarfs stand out against background glow.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-soft bg-page/50 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectTheme(DEFAULT_THEME_ID)}
              className="btn-plain h-9 px-3.5 text-xs"
              title="Reset theme to SkyFlip Classic"
            >
              Reset default
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-primary h-9 px-5 text-xs font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
