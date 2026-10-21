// Záloha dat do souboru a obnova ze zálohy.
//
// Záloha (JSON) obsahuje všechno, co aplikace ukládá v zařízení:
//   { "app": "hypertrophica", "schemaVersion": 2, "exportedAt": "2026-10-13T18:30:00.000Z",
//     "sets": [ … série … ], "favorites": [ … ID cviků … ], "week": { "active": 0, "slots": [ … ] },
//     "body": [ … měření hmotnosti a měr … ], "targets": { … plánované série, viz js/targets.js … } }
// Záloha verze 1 (před přidáním pohledu Tělo) pole "body" nemá – importuje se bez měření.
// Starší zálohy nemají pole "targets" – importují se bez plánovaných sérií.
// Soubor si uživatel uloží (Stažené soubory, Disk Google…) a později ho může importovat
// zpět – na stejném nebo jiném zařízení.

import { SCHEMA_VERSION, normalizeSet } from './log.js';
import { METRIC_KEYS, normalize as normalizeBody } from './body.js';

const APP_ID = 'hypertrophica';

export function createBackup({ sets, favorites, week, body, targets }) {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    sets,
    favorites,
    week,
    body,
    targets,
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
// Vrátí { sets, skipped, favorites, week, body, bodySkipped, targets, exportedAt }; skipped = počet vynechaných
// sérií (neplatné hodnoty, neznámý cvik, duplicitní id), bodySkipped = počet vynechaných měření
// (neplatné datum, žádná platná hodnota, stejný den dvakrát). Při zásadní chybě vyhodí BackupError.
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
  const rawBody = Array.isArray(data.body) ? data.body : [];
  const days = new Set();
  const body = [];
  rawBody.forEach((raw) => {
    const record = normalizeBody(raw);
    if (record && !days.has(record.id)) {
      days.add(record.id);
      body.push(record);
    }
  });
  return {
    sets,
    skipped: rawSets.length - sets.length,
    favorites,
    week: data.week ?? null,
    body,
    bodySkipped: rawBody.length - body.length,
    targets: data.targets ?? null, // zkontroluje js/targets.js při importu
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null,
  };
}

// Tabulka sérií pro Excel / Tabulky Google (jen export, zpět importovat nejde).
// Česká podoba: oddělovač středník, desetinná čárka. Na začátku je znak BOM,
// podle kterého Excel pozná kódování UTF-8 (jinak by rozbil diakritiku).
// sets = série seřazené chronologicky, nameOf(id) = název cviku,
// header = názvy 7 sloupců v jazyce rozhraní (backup.csvHeader v i18n).
export function createCsv(sets, nameOf, header) {
  const counters = new Map(); // "datum|cvik" → pořadí série v rámci dne
  const rows = sets.map((s) => {
    const key = `${s.date}|${s.exerciseId}`;
    const number = (counters.get(key) ?? 0) + 1;
    counters.set(key, number);
    return [s.date, nameOf(s.exerciseId), s.exerciseId, number, s.reps,
      String(s.weightKg).replace('.', ','), s.rir ?? ''];
  });
  return '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

// Tabulka měření (hmotnost a míry) pro Excel, stejný formát jako tabulka sérií.
// records = měření seřazená podle data, header = názvy sloupců (backup.bodyCsvHeader v i18n):
// datum a pak míry v pořadí METRIC_KEYS. Nevyplněná míra = prázdná buňka.
export function createBodyCsv(records, header) {
  const rows = records.map((r) => [r.date,
    ...METRIC_KEYS.map((key) => (r[key] === null ? '' : String(r[key]).replace('.', ',')))]);
  return '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

// Hodnotu se středníkem, uvozovkami nebo zalomením řádku obalí uvozovkami (pravidlo formátu CSV).
function csvCell(value) {
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
