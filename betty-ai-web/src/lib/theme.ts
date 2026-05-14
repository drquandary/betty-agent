export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'betty-ai-theme';
export const DEFAULT_THEME: Theme = 'dark';
export const THEME_CHANGED_EVENT = 'betty-ai:theme-changed';

export function resolveTheme(value: unknown): Theme {
  return value === 'light' ? 'light' : 'dark';
}

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    return resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export function writeStoredTheme(theme: Theme): void {
  const resolved = resolveTheme(theme);
  applyTheme(resolved);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, resolved);
  } catch {
    /* private mode — ignore */
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: resolved }));
}

// Inline-script source. Runs before hydration to set data-theme so the page
// does not flash dark when the stored preference is light.
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.dataset.theme=t==='light'?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`;
