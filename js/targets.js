// Plánované série: předpis sérií pro cvik v jednom z tréninků 1–4
// (např. Trénink 2 → Bench press: 80 kg × 8, 80 kg × 8, 80 kg × 8).
// Plán je šablona, opakuje se každý týden. Skutečně odcvičené série ukládá js/log.js;
// série zapsaná odškrtnutím řádku plánu má v poli planRowId id tohoto řádku.
//
// Ukládá se do localStorage prohlížeče pod klíčem hw.targets:
//   { "0": { "bench-press-barbell": [ { "id": "k3f9a2", "weightKg": 80, "reps": 8, "rir": 2 } ] } }
// Klíč "0"–"3" = slot (Trénink 1–4), uvnitř ID cviku → seřazené řádky plánu.
// id řádku je krátký náhodný text; podle něj se pozná, který záznam patří ke kterému řádku,
// i když se řádky mezi tím přidají nebo smažou.
//
// Stejně jako u tréninků (js/plan.js) je každý přístup k localStorage v try/catch:
// když není dostupné, plán funguje aspoň do zavření stránky.

import { SLOT_COUNT } from './plan.js';
import { cleanWeight, isValidReps, isValidRir } from './log.js';

const STORAGE_KEY = 'hw.targets';

let targets = read();

// Z libovolné hodnoty (localStorage nebo záloha) udělá platný plán; neplatné řádky vynechá.
function clean(stored) {
  const result = {};
  if (!stored || typeof stored !== 'object') return result;
  for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
    const exercises = stored[slot];
    if (!exercises || typeof exercises !== 'object') continue;
    for (const [exerciseId, rows] of Object.entries(exercises)) {
      const valid = Array.isArray(rows) ? rows.map(cleanRow).filter(Boolean) : [];
      if (valid.length) (result[slot] ??= {})[exerciseId] = valid;
    }
  }
  return result;
}

// Jeden řádek plánu: stejné rozsahy jako u zapsané série. Vrátí platný řádek, nebo null.
function cleanRow(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const weightKg = cleanWeight(raw.weightKg);
  const rir = raw.rir ?? null;
  if (typeof raw.id !== 'string' || raw.id.length === 0 || raw.id.length > 40) return null;
  if (weightKg === null || !isValidReps(raw.reps) || !isValidRir(rir)) return null;
  return { id: raw.id, weightKg, reps: raw.reps, rir };
}

function read() {
  try {
    return clean(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return {};
  }
}

function write() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
  } catch {
    // Uložit nejde – plán zůstane jen v paměti.
  }
}

function newRowId() {
  return Math.random().toString(36).slice(2, 10);
}

// Uloží řádky cviku; prázdný seznam cvik (a prázdný slot) z plánu úplně odstraní.
function store(slot, exerciseId, rows) {
  if (rows.length) {
    (targets[slot] ??= {})[exerciseId] = rows;
  } else if (targets[slot]) {
    delete targets[slot][exerciseId];
    if (Object.keys(targets[slot]).length === 0) delete targets[slot];
  }
  write();
}

// ===== Čtení =====

// Řádky plánu cviku v daném slotu (kopie, aby se nedaly omylem změnit mimo tento modul).
export function getRows(slot, exerciseId) {
  return (targets[slot]?.[exerciseId] ?? []).map((row) => ({ ...row }));
}

// Celý plán jako kopie (pro zálohu do souboru).
export function getAll() {
  return JSON.parse(JSON.stringify(targets));
}

// ===== Zápis =====
// values = { weightKg, reps, rir } (už zkontrolované formulářem).

// Přidá řádek na konec a vrátí ho.
export function addRow(slot, exerciseId, values) {
  const row = { id: newRowId(), weightKg: values.weightKg, reps: values.reps, rir: values.rir };
  store(slot, exerciseId, [...getRows(slot, exerciseId), row]);
  return row;
}

export function updateRow(slot, exerciseId, rowId, values) {
  store(slot, exerciseId, getRows(slot, exerciseId).map((row) => (row.id === rowId
    ? { id: row.id, weightKg: values.weightKg, reps: values.reps, rir: values.rir }
    : row)));
}

export function removeRow(slot, exerciseId, rowId) {
  store(slot, exerciseId, getRows(slot, exerciseId).filter((row) => row.id !== rowId));
}

// Nahradí všechny řádky cviku (např. „Podle minula“ = série z posledního tréninku).
export function setRows(slot, exerciseId, list) {
  store(slot, exerciseId, list.map((values) => ({
    id: newRowId(), weightKg: values.weightKg, reps: values.reps, rir: values.rir,
  })));
}

// Vyřadí plán cviků, které v daném tréninku už nejsou (odebraný cvik, „Nový týden“…).
// slots = pole 4 polí ID cviků (plan.getSlots()).
export function retain(slots) {
  let changed = false;
  for (const slot of Object.keys(targets)) {
    for (const exerciseId of Object.keys(targets[slot])) {
      if (!slots[slot]?.includes(exerciseId)) {
        delete targets[slot][exerciseId];
        changed = true;
      }
    }
    if (Object.keys(targets[slot]).length === 0) delete targets[slot];
  }
  if (changed) write();
}

// Import ze zálohy. mode 'replace': plán se nahradí zálohou.
// mode 'merge': ze zálohy se převezme plán jen u tréninků, které v zařízení žádný plán nemají
// (stejně jako u tréninků v js/plan.js). Cviky, které v tréninku nejsou, pak vyřadí retain().
export function importTargets(data, mode) {
  const imported = clean(data);
  if (mode === 'replace') {
    targets = imported;
  } else {
    for (const slot of Object.keys(imported)) targets[slot] ??= imported[slot];
  }
  write();
}

// Zavolá `callback`, když se plán změní v jiné záložce téhož prohlížeče.
export function onExternalChange(callback) {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    targets = read();
    callback();
  });
}
