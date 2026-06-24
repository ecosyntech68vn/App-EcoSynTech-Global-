import { get, set } from 'idb-keyval';
const KEY = 'ui:theme';
const FONT_KEY = 'ui:font_scale';

const THEMES = {
  light: {
    '--c-primary': '#2E7D32',
    '--c-primary-dark': '#1B5E20',
    '--c-accent': '#C9A227',
    '--c-bg': '#F7F8F5',
    '--c-card': '#FFFFFF',
    '--c-text': '#1A1A1A',
    '--c-text-muted': '#5C6B6B',
    '--c-border': '#E1E5DD',
    '--c-shadow': '0 2px 8px rgba(0,0,0,.08)'
  },
  dark: {
    '--c-primary': '#388E3C',
    '--c-primary-dark': '#2E7D32',
    '--c-accent': '#D4A843',
    '--c-bg': '#121212',
    '--c-card': '#1E1E1E',
    '--c-text': '#E0E0E0',
    '--c-text-muted': '#9E9E9E',
    '--c-border': '#333333',
    '--c-shadow': '0 2px 8px rgba(0,0,0,.3)'
  }
};

export const themeStore = {
  async load() {
    return (await get(KEY)) || 'light';
  },
  async save(theme) {
    await set(KEY, theme);
    this.apply(theme);
  },
  apply(theme) {
    const vars = THEMES[theme] || THEMES.light;
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars)) {
      root.style.setProperty(k, v);
    }
    root.style.setProperty('color-scheme', theme);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', vars['--c-primary']);
  },
  getThemeList() { return Object.keys(THEMES); }
};

export const fontStore = {
  KEY: FONT_KEY,
  async load() { return (await get(FONT_KEY)) || 100; },
  async save(scale) { await set(FONT_KEY, scale); this.apply(scale); },
  apply(scale) {
    document.documentElement.style.setProperty('--font-scale', (scale / 100).toFixed(2));
  }
};
