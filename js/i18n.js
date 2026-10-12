// Texty uživatelského rozhraní (i18n = internationalization).
// Texty jsou v souborech i18n/<jazyk>.json, tady se jen načtou a vyhledávají.

const FALLBACK_LANG = 'cs';

let lang = FALLBACK_LANG;
let strings = {};

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
