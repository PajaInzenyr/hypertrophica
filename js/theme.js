// Volba motivu v Nastavení (podle systému / světlý / tmavý).
//
// Zvolený motiv se zapisuje jako atribut data-theme na <html> („light“ nebo „dark“);
// podle něj style.css vybere sadu barev. Bez atributu se řídí nastavením systému.
// Volba se ukládá do localStorage (klíč hw.theme); „automaticky“ = klíč smazaný.
// Ještě před vykreslením stránky ji načte krátký skript v <head> v index.html.

import { t } from './i18n.js';

const STORAGE_KEY = 'hw.theme';

// Pořadí voleb v Nastavení.
const MODES = ['auto', 'light', 'dark'];

// Barva lišty prohlížeče = barva hlavičky (--surface) v daném motivu.
const THEME_COLORS = { light: '#ffffff', dark: '#1f1e1c' };

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

// Vytvoří v kontejneru tři přepínače (radio) a napojí je na motiv.
// Volá se hned při startu, aby se motiv uplatnil i předtím, než se Nastavení otevře.
export function initTheme(container) {
  const inputs = MODES.map((mode) => {
    const input = Object.assign(document.createElement('input'), {
      type: 'radio',
      name: 'theme',
      value: mode,
    });
    input.addEventListener('change', () => {
      apply(mode);
      save(mode);
    });
    const label = document.createElement('label');
    label.className = 'theme-option';
    label.append(input, t(`theme.${mode}`));
    container?.append(label);
    return input;
  });

  // Zaškrtne volbu podle aktuálního motivu.
  const render = () => {
    const mode = currentMode();
    inputs.forEach((input) => { input.checked = input.value === mode; });
  };

  // Změna motivu v jiné záložce téhož prohlížeče se projeví i tady.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    apply(MODES.includes(event.newValue) ? event.newValue : 'auto');
    render();
  });

  apply(currentMode());
  render();
}
