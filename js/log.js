// Záznamy sérií (hmotnost × opakování). Ukládají se do IndexedDB – databáze v prohlížeči,
// která na rozdíl od localStorage zvládne i tisíce záznamů a umí je hledat podle cviku.
//
// Jeden záznam = jedna série:
//   { "id": "…", "exerciseId": "bench-press-barbell", "date": "2026-10-13",
//     "reps": 8, "weightKg": 80, "rir": 2,
//     "createdAt": "2026-10-13T18:22:05.000Z", "updatedAt": "2026-10-13T18:22:05.000Z" }
// - id: náhodné jedinečné ID (UUID), podle něj se pozná stejná série při importu zálohy
// - date: den tréninku (místní čas), createdAt: přesný čas uložení (pořadí sérií v rámci dne)
// - rir: „reps in reserve“ = kolik opakování zbývalo do selhání; null = nezadáno
//
// Data jsou jen v tomto prohlížeči a zařízení. Zálohu do souboru řeší js/backup.js.
// Když IndexedDB není dostupná (některá anonymní okna, zakázaná data webu), záznamy
// se drží jen v paměti a zmizí po zavření stránky – aplikace na to upozorní.

const DB_NAME = 'hypertrophica';
// Verze struktury databáze. Při změně struktury ji zvyš a doplň převod v upgrade().
export const SCHEMA_VERSION = 1;
const STORE = 'sets';

// Povolené rozsahy hodnot (kontrola formuláře i importu).
export const LIMITS = {
  reps: { min: 1, max: 100 },
  weightKg: { min: 0, max: 1000 },
  rir: { min: 0, max: 10 },
};

let dbPromise = null;
let memory = null; // náhradní úložiště v paměti (Map id → záznam), když IndexedDB nejde použít

// Otevře databázi (jen poprvé, pak vrací stejné spojení). Vrátí null, když IndexedDB nejde použít.
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    // Spustí se při prvním otevření nebo po zvýšení SCHEMA_VERSION: vytvoří tabulku a indexy.
    request.onupgradeneeded = (event) => upgrade(request.result, event.oldVersion);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    console.warn('IndexedDB není dostupná, záznamy zůstanou jen v paměti:', error);
    memory = new Map();
    return null;
  });
  return dbPromise;
}

function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    const store = db.createObjectStore(STORE, { keyPath: 'id' });
    // Indexy = rychlé hledání všech sérií jednoho cviku a všech sérií jednoho dne.
    store.createIndex('exerciseId', 'exerciseId');
    store.createIndex('date', 'date');
  }
  // Budoucí verze: if (oldVersion < 2) { … převod dat … }
}

// Převede požadavek IndexedDB (callback API) na Promise, aby šel použít s await.
function done(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Promise, který se splní, až se zápis (transakce) opravdu dokončí.
function committed(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// true = záznamy se ukládají natrvalo; false = jen v paměti do zavření stránky.
export async function isStorageAvailable() {
  return (await openDb()) !== null;
}

// ===== Čtení =====

// Pořadí: od nejstaršího dne, v rámci dne podle času uložení.
function chronological(a, b) {
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
}

export async function getAllSets() {
  const db = await openDb();
  const sets = db
    ? await done(db.transaction(STORE).objectStore(STORE).getAll())
    : [...memory.values()];
  return sets.sort(chronological);
}

export async function getSetsForExercise(exerciseId) {
  const db = await openDb();
  const sets = db
    ? await done(db.transaction(STORE).objectStore(STORE).index('exerciseId').getAll(exerciseId))
    : [...memory.values()].filter((s) => s.exerciseId === exerciseId);
  return sets.sort(chronological);
}

// ===== Zápis =====

// Uloží novou sérii a vrátí celý uložený záznam.
export async function addSet({ exerciseId, reps, weightKg, rir = null }) {
  const now = new Date();
  const record = {
    id: newId(),
    exerciseId,
    date: localDate(now),
    reps,
    weightKg,
    rir,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await putAll([record]);
  requestPersistence();
  return record;
}

export async function deleteSet(id) {
  const db = await openDb();
  if (!db) {
    memory.delete(id);
    return;
  }
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await committed(tx);
}

// Import ze zálohy (records už prošly kontrolou normalizeSet).
// mode 'merge': přidá nové série; série se stejným id přepíše jen tehdy, když je v záloze novější.
// mode 'replace': smaže všechny série v zařízení a nahradí je zálohou.
// Vrátí počty { added, updated, unchanged }.
export async function importSets(records, mode) {
  const existing = new Map(mode === 'replace' ? [] : (await getAllSets()).map((s) => [s.id, s]));
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
  const db = await openDb();
  if (!db) {
    if (clearFirst) memory.clear();
    records.forEach((r) => memory.set(r.id, r));
    return;
  }
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  if (clearFirst) store.clear();
  records.forEach((r) => store.put(r));
  await committed(tx);
}

// Požádá prohlížeč, aby data webu nemazal ani při nedostatku místa.
// Chrome u nainstalované aplikace obvykle vyhoví bez dotazu; když nevyhoví, nic se neděje.
function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}

// ===== Pomocné funkce =====

// Dnešní datum v místním čase jako "2026-10-13" (toISOString by vrátil datum v UTC,
// takže trénink po půlnoci letního času by se mohl zapsat k jinému dni).
export function localDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Jedinečné ID série. crypto.randomUUID funguje jen přes https (a localhost) – GitHub Pages ho má.
function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const isInt = (value, { min, max }) => Number.isInteger(value) && value >= min && value <= max;

// Hmotnost: číslo v rozsahu, nejvýš 2 desetinná místa (zaokrouhlí, např. 22.499999 → 22.5).
export function cleanWeight(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < LIMITS.weightKg.min || value > LIMITS.weightKg.max) return null;
  return Math.round(value * 100) / 100;
}

export const isValidReps = (value) => isInt(value, LIMITS.reps);
export const isValidRir = (value) => value === null || isInt(value, LIMITS.rir);

// Zkontroluje a vyčistí sérii načtenou ze souboru zálohy. Vrátí platný záznam, nebo null.
// knownIds = ID existujících cviků (série neznámého cviku se přeskočí).
export function normalizeSet(raw, knownIds) {
  if (!raw || typeof raw !== 'object') return null;
  const { id, exerciseId, date, reps } = raw;
  const rir = raw.rir ?? null;
  const weightKg = cleanWeight(raw.weightKg);
  if (typeof id !== 'string' || id.length === 0 || id.length > 100) return null;
  if (typeof exerciseId !== 'string' || !knownIds.has(exerciseId)) return null;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return null;
  if (!isValidReps(reps) || weightKg === null || !isValidRir(rir)) return null;
  // Časy: platný ISO zápis, jinak poledne daného dne (aby šlo série seřadit).
  const time = (value) => (typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : `${date}T12:00:00.000Z`);
  const createdAt = time(raw.createdAt);
  return { id, exerciseId, date, reps, weightKg, rir, createdAt, updatedAt: time(raw.updatedAt ?? createdAt) };
}
