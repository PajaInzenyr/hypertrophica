// Hmotnost a tělesné míry (pohled Tělo, adresa #/telo). Ukládají se do stejné databáze
// IndexedDB jako série (js/log.js), jen do vlastní tabulky „body“.
//
// Jeden záznam = jeden den měření:
//   { "id": "2026-10-19", "date": "2026-10-19", "weightKg": 82.4, "bodyFat": null,
//     "neck": null, "chest": 104, "waist": 84.5, "hips": null, "arm": 38, "thigh": null, "calf": null,
//     "createdAt": "2026-10-19T07:12:00.000Z", "updatedAt": "2026-10-19T07:12:00.000Z" }
// - id = date: na jeden den připadá nejvýš jeden záznam. Formulář se při volbě dne
//   předvyplní uloženými hodnotami, takže další zadání ve stejný den záznam doplní.
// - nevyplněná míra = null; aspoň jedna míra musí být vyplněná.

import { openDb, done, committed, requestPersistence, BODY_STORE } from './log.js';

// Sledované míry v pořadí, v jakém se zobrazují. Klíč = název pole v záznamu,
// texty jsou v i18n pod body.metric.<klíč>.
// unit: jednotka; min/max: povolený rozsah; step: o kolik mění hodnotu tlačítka − a +;
// start: hodnota po klepnutí na + u prázdného políčka, když ještě nic není zapsané.
export const METRICS = [
  { key: 'weightKg', unit: 'kg', min: 20, max: 400, step: 0.1, start: 80 },
  { key: 'bodyFat', unit: '%', min: 2, max: 70, step: 0.5, start: 15 },
  { key: 'neck', unit: 'cm', min: 20, max: 80, step: 0.5, start: 38 },
  { key: 'chest', unit: 'cm', min: 50, max: 200, step: 0.5, start: 100 },
  { key: 'waist', unit: 'cm', min: 40, max: 200, step: 0.5, start: 85 },
  { key: 'hips', unit: 'cm', min: 50, max: 200, step: 0.5, start: 95 },
  { key: 'arm', unit: 'cm', min: 15, max: 80, step: 0.5, start: 35 },
  { key: 'thigh', unit: 'cm', min: 30, max: 120, step: 0.5, start: 55 },
  { key: 'calf', unit: 'cm', min: 20, max: 70, step: 0.5, start: 37 },
];
export const METRIC_KEYS = METRICS.map((m) => m.key);

let memory = null; // náhradní úložiště v paměti (Map id → záznam), když IndexedDB nejde použít

async function db() {
  const database = await openDb();
  if (!database) memory ??= new Map();
  return database;
}

// Hodnota míry: číslo v rozsahu, zaokrouhlené na 1 desetinné místo. Mimo rozsah / nesmysl → undefined.
export function cleanValue(key, value) {
  const metric = METRICS.find((m) => m.key === key);
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < metric.min || value > metric.max) return undefined;
  return Math.round(value * 10) / 10;
}

const hasAnyValue = (record) => METRIC_KEYS.some((key) => record[key] !== null);

// ===== Čtení =====

// Všechna měření od nejstaršího dne.
export async function getAll() {
  const database = await db();
  const records = database
    ? await done(database.transaction(BODY_STORE).objectStore(BODY_STORE).getAll())
    : [...memory.values()];
  return records.sort((a, b) => a.date.localeCompare(b.date));
}

// ===== Zápis =====

// Uloží měření jednoho dne. values = { weightKg: 82.4, waist: null, … } (už zkontrolované).
// Uložené hodnoty toho dne se nahradí – formulář je předvyplněný, takže se nic neztratí.
// Vrátí uložený záznam.
export async function save(date, values) {
  const existing = (await getAll()).find((r) => r.id === date);
  const now = new Date().toISOString();
  const record = { id: date, date };
  METRIC_KEYS.forEach((key) => { record[key] = cleanValue(key, values[key]) ?? null; });
  record.createdAt = existing?.createdAt ?? now;
  record.updatedAt = now;
  await putAll([record]);
  requestPersistence();
  return record;
}

export async function remove(id) {
  const database = await db();
  if (!database) {
    memory.delete(id);
    return;
  }
  const tx = database.transaction(BODY_STORE, 'readwrite');
  tx.objectStore(BODY_STORE).delete(id);
  await committed(tx);
}

// Import ze zálohy (records už prošly kontrolou normalize), stejná pravidla jako u sérií:
// mode 'merge': přidá chybějící dny; den, který už v zařízení je, přepíše jen novější záznam ze zálohy.
// mode 'replace': smaže všechna měření v zařízení a nahradí je zálohou.
// Vrátí počty { added, updated, unchanged }.
export async function importRecords(records, mode) {
  const existing = new Map(mode === 'replace' ? [] : (await getAll()).map((r) => [r.id, r]));
  const result = { added: 0, updated: 0, unchanged: 0 };
  const toWrite = [];
  for (const record of records) {
    const current = existing.get(record.id);
    if (!current) {
      result.added += 1;
      toWrite.push(record);
    } else if (record.updatedAt > current.updatedAt) {
      result.updated += 1;
      toWrite.push(record);
    } else {
      result.unchanged += 1;
    }
  }
  await putAll(toWrite, mode === 'replace');
  if (toWrite.length) requestPersistence();
  return result;
}

// Zapíše záznamy v jedné transakci (buď se uloží všechny, nebo žádný).
async function putAll(records, clearFirst = false) {
  const database = await db();
  if (!database) {
    if (clearFirst) memory.clear();
    records.forEach((r) => memory.set(r.id, r));
    return;
  }
  const tx = database.transaction(BODY_STORE, 'readwrite');
  const store = tx.objectStore(BODY_STORE);
  if (clearFirst) store.clear();
  records.forEach((r) => store.put(r));
  await committed(tx);
}

// Zkontroluje a vyčistí měření ze souboru zálohy. Vrátí platný záznam, nebo null.
// Míra mimo rozsah se vynechá (null); záznam bez jediné platné míry se přeskočí celý.
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { date } = raw;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return null;
  const record = { id: date, date };
  METRIC_KEYS.forEach((key) => { record[key] = cleanValue(key, raw[key]) ?? null; });
  if (!hasAnyValue(record)) return null;
  const time = (value) => (typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : `${date}T12:00:00.000Z`);
  record.createdAt = time(raw.createdAt);
  record.updatedAt = time(raw.updatedAt ?? raw.createdAt);
  return record;
}
