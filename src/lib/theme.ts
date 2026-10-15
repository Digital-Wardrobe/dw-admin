/* Light, dark or follow the system. Stored per browser; applied before the first paint. */
export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'admin_theme';

export function themePref(): ThemePref {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function applyTheme(pref: ThemePref = themePref()) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function setThemePref(pref: ThemePref) {
  if (pref === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref);
  applyTheme(pref);
}

/** Follow the system setting while the preference is "system". */
export function watchSystemTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const on = () => { if (themePref() === 'system') applyTheme('system'); };
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}
