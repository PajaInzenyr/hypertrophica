// Záloha dat do souboru a obnova ze zálohy.
//
// Záloha (JSON) obsahuje všechno, co aplikace ukládá v zařízení:
//   { "app": "hypertrophica", "schemaVersion": 1, "exportedAt": "2026-10-13T18:30:00.000Z",
//     "sets": [ … série … ], "favorites": [ … ID cviků … ], "week": { "active": 0, "slots": [ … ] } }
// Soubor si uživatel uloží (Stažené soubory, Disk Google…) a později ho může importovat
// zpět – na stejném nebo jiném zařízení.

import { SCHEMA_VERSION, normalizeSet } from './log.js';

const APP_ID = 'hypertrophica';

export function createBackup({ sets, favorites, week }) {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    sets,
    favorites,
    week,
  };
}

// Chyba importu; `key` je klíč textu v i18n/cs.json, který se ukáže uživateli.
export class BackupError extends Error {
  constructor(key) {
    super(key);
    this.key = key;
  }
}

// Přečte a zkontroluje obsah souboru se zálohou. knownIds = ID existujících cviků.
// Vrátí { sets, skipped, favorites, week, exportedAt }; skipped = počet vynechaných
// sérií (neplatné hodnoty, neznámý cvik, duplicitní id). Při zásadní chybě vyhodí BackupError.
export function parseBackup(text, knownIds) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('backup.errorJson');
  }
  if (!data || data.app !== APP_ID) throw new BackupError('backup.errorNotBackup');
  if (!Number.isInteger(data.schemaVersion) || data.schemaVersion < 1) throw new BackupError('backup.errorNotBackup');
  // Záloha z novější verze aplikace může mít jinou strukturu – raději ji nečíst.
  if (data.schemaVersion > SCHEMA_VERSION) throw new BackupError('backup.errorVersion');

  const rawSets = Array.isArray(data.sets) ? data.sets : [];
  const seen = new Set();
  const sets = [];
  rawSets.forEach((raw) => {
    const set = normalizeSet(raw, knownIds);
    if (set && !seen.has(set.id)) {
      seen.add(set.id);
      sets.push(set);
    }
  });
  const favorites = Array.isArray(data.favorites)
    ? [...new Set(data.favorites.filter((id) => knownIds.has(id)))]
    : [];
  return {
    sets,
    skipped: rawSets.length - sets.length,
    favorites,
    week: data.week ?? null,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null,
  };
}

// Uloží text do souboru. Na mobilu nabídne systémové sdílení (Disk Google, e-mail…),
// pokud prohlížeč daný typ souboru sdílet umí; jinak (a na PC) soubor stáhne.
// Vrátí 'shared', 'downloaded', nebo 'cancelled' (uživatel sdílení zavřel).
export async function saveFile(filename, content, type) {
  const file = new File([content], filename, { type });
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled';
      // Jiná chyba sdílení → zkus soubor aspoň stáhnout.
    }
  }
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  // Adresu souboru uvolni až po chvíli – stahování se spouští asynchronně.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
