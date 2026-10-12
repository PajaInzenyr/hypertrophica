// Přepínač motivu (světlý / tmavý / automaticky podle systému).
//
// Zvolený motiv se zapisuje jako atribut data-theme na <html> („light“ nebo „dark“);
// podle něj style.css vybere sadu barev. Bez atributu se řídí nastavením systému.
// Volba se ukládá do localStorage (klíč hw.theme); „automaticky“ = klíč smazaný.
// Ještě před vykreslením stránky ji načte krátký skript v <head> v index.html.

import { t } from './i18n.js';

const STORAGE_KEY = 'hw.theme';

// Pořadí, ve kterém se motivy po klepnutí střídají.
const MODES = ['auto', 'light', 'dark'];

// Barva lišty prohlížeče = barva hlavičky (--surface) v daném motivu.
const THEME_COLORS = { light: '#ffffff', dark: '#1f1e1c' };

const ICONS = {
  // Kruh napůl vyplněný = podle systému
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  // Slunce
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  // Měsíc
  dark: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
};

function currentMode() {
  const theme = document.documentElement.dataset.theme;
  return MODES.includes(theme) ? theme : 'auto';
}

function save(mode) {
  try {
    if (mode === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Uložit nejde – motiv platí jen do zavření stránky.
  }
}

function apply(mode) {
  if (mode === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;

  // <meta name="theme-color"> jsou v index.html dvě (pro světlý a tmavý systém).
  // Při ručně zvoleném motivu dostanou obě jeho barvu, při „auto“ původní hodnoty.
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.dataset.default ??= meta.content;
    meta.content = mode === 'auto' ? meta.dataset.default : THEME_COLORS[mode];
  });
}

export function initThemeToggle(button) {
  if (!button) return;

  const render = () => {
    const mode = currentMode();
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    const label = t('theme.toggle', { current: t(`theme.${mode}`), next: t(`theme.${next}`) });
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[mode]}</svg>`;
    button.setAttribute('aria-label', label);
    button.title = label;
  };

  button.addEventListener('click', () => {
    const mode = MODES[(MODES.indexOf(currentMode()) + 1) % MODES.length];
    apply(mode);
    save(mode);
    render();
  });

  // Změna motivu v jiné záložce téhož prohlížeče se projeví i tady.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    apply(MODES.includes(event.newValue) ? event.newValue : 'auto');
    render();
  });

  apply(currentMode());
  render();
  button.hidden = false;
}
