// Texty uživatelského rozhraní (i18n = internationalization).
// Texty jsou v souborech i18n/<jazyk>.json, tady se jen načtou a vyhledávají.

const FALLBACK_LANG = 'cs';

// Dostupné jazyky; nový jazyk = nový soubor i18n/<kód>.json + kód sem (a do sw.js).
// Názvy jazyků se vždy píšou v daném jazyce, aby je člověk našel i v cizím rozhraní.
const LANGS = { cs: 'Čeština', en: 'English' };

// Formát data a čísel pro daný jazyk. Angličtina = britská podoba:
// datum 13/10/2026 (den před měsícem) a týden od pondělí, stejně jako česky.
const LOCALES = { cs: 'cs', en: 'en-GB' };

// Volba jazyka v Nastavení se ukládá do localStorage (klíč hw.lang);
// „Systém“ = klíč smazaný, jazyk se pak řídí jazykem prohlížeče.
const STORAGE_KEY = 'hw.lang';

let lang = FALLBACK_LANG;
let strings = {};

// Kód formátu pro Intl / toLocaleDateString / localeCompare podle aktuálního jazyka.
export function currentLocale() {
  return LOCALES[lang];
}

function savedLang() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value in LANGS ? value : null;
  } catch {
    return null; // localStorage nedostupné → řídí se prohlížečem
  }
}

// Jazyk podle prohlížeče: čeština a slovenština → čeština, cokoli jiného → angličtina.
// navigator.languages = jazyky seřazené podle priority (např. ["cs-CZ", "en-US"]).
function browserLang() {
  const first = (navigator.languages?.[0] || navigator.language || '').toLowerCase();
  return /^(cs|sk)\b/.test(first) ? 'cs' : 'en';
}

// Jazyk, ve kterém se má aplikace spustit: uložená volba, jinak podle prohlížeče.
export function preferredLang() {
  return savedLang() ?? browserLang();
}

export async function loadStrings(newLang = FALLBACK_LANG) {
  const response = await fetch(`./i18n/${newLang}.json`);
  if (!response.ok) throw new Error(`i18n: ${response.status}`);
  strings = await response.json();
  lang = newLang;
}

// t('filters.reset') → "Zrušit filtry"
// t('list.count', { count: 5 }) → "Nalezeno cviků: 5" (nahradí {count})
// Pokud klíč chybí, vrátí samotný klíč, aby chyba byla v UI vidět.
export function t(key, params = {}) {
  const value = key.split('.').reduce((obj, part) => obj?.[part], strings);
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (match, name) => params[name] ?? match);
}

// Vybere text ve správném jazyce z vícejazyčného objektu z dat,
// např. { "cs": "Prsa", "en": "Chest" }. Když překlad chybí, použije češtinu.
export function localized(obj) {
  if (!obj) return '';
  return obj[lang] || obj[FALLBACK_LANG] || '';
}

// Doplní texty do statického HTML podle atributů:
//   data-i18n="klíč"              → textový obsah prvku
//   data-i18n-placeholder="klíč"  → atribut placeholder
//   data-i18n-aria-label="klíč"   → atribut aria-label
export function applyStaticStrings(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
  document.documentElement.lang = lang;
}

// Vytvoří v Nastavení přepínače jazyka: Systém / Čeština / English.
// Po změně se volba uloží a stránka se znovu načte – celá aplikace se tak
// vykreslí v novém jazyce bez nutnosti překreslovat každý pohled zvlášť.
export function initLanguage(container) {
  if (!container) return;
  const selected = savedLang() ?? 'auto';
  ['auto', ...Object.keys(LANGS)].forEach((value) => {
    const input = Object.assign(document.createElement('input'), {
      type: 'radio',
      name: 'language',
      value,
      checked: value === selected,
    });
    input.addEventListener('change', () => {
      try {
        if (value === 'auto') localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // Uložit nejde (např. zakázané úložiště) – po obnovení by se volba ztratila.
        return;
      }
      location.reload();
    });
    const label = document.createElement('label');
    label.className = 'theme-option';
    label.append(input, value === 'auto' ? t('language.auto') : LANGS[value]);
    // lang u názvu jazyka: čtečka obrazovky ho přečte správnou výslovností.
    if (value !== 'auto') label.lang = value;
    container.append(label);
  });
}
