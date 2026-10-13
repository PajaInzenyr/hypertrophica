// Tréninky v týdnu: 4 sloty („Trénink 1–4“), každý = seřazený seznam ID cviků
// (jen pořadí, žádné série ani váhy). Jeden slot je „aktivní“ – s ním pracují
// tlačítka ⊕ v seznamu a detailu, šipky, sdílení i ikona v hlavičce.
//
// Ukládá se do localStorage prohlížeče pod klíčem hw.week:
//   { "active": 0, "slots": [["id1", "id2"], [], [], []] }
// takže přežije zavření stránky – ale jen na tomto zařízení a v tomto prohlížeči.
// Každý cvik je v jednom slotu nejvýš jednou (v různých slotech může být).
//
// Stejně jako u oblíbených je každý přístup k localStorage v try/catch:
// když není dostupné, tréninky fungují aspoň do zavření stránky.

export const SLOT_COUNT = 4;

const STORAGE_KEY = 'hw.week';
// Starší verze aplikace ukládala jediný trénink pod hw.plan (pole ID).
// Při prvním spuštění nové verze se přesune do slotu 1 a starý klíč se smaže.
const LEGACY_KEY = 'hw.plan';
// Zámek tréninků: když je zamčeno, aplikace nedovolí cviky přesouvat ani odebírat
// (ochrana proti nechtěnému klepnutí během cvičení). Platí pro všechny sloty.
// Uloženo jako "1" / nic.
const LOCK_KEY = 'hw.planLocked';

let week = read();
let locked = readLocked();

// Prázdný týden: aktivní slot 1, všechny sloty prázdné.
function emptyWeek() {
  return { active: 0, slots: Array.from({ length: SLOT_COUNT }, () => []) };
}

// Z libovolné hodnoty (i poškozené) udělá platný seznam ID bez duplicit.
function cleanIds(value) {
  return Array.isArray(value) ? unique(value.filter((id) => typeof id === 'string')) : [];
}

// Z uložené hodnoty (localStorage nebo záloha) udělá platný týden; null, když to týden není.
function cleanWeek(stored) {
  if (!stored || !Array.isArray(stored.slots)) return null;
  const result = emptyWeek();
  result.slots = result.slots.map((_, i) => cleanIds(stored.slots[i]));
  const active = Number(stored.active);
  result.active = Number.isInteger(active) && active >= 0 && active < SLOT_COUNT ? active : 0;
  return result;
}

function read() {
  try {
    const stored = cleanWeek(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    if (stored) return stored;
    // Nová data zatím nejsou → zkus převést starý jediný trénink.
    const legacy = cleanIds(JSON.parse(localStorage.getItem(LEGACY_KEY)));
    const result = emptyWeek();
    if (legacy.length) {
      result.slots[0] = legacy;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      localStorage.removeItem(LEGACY_KEY);
    }
    return result;
  } catch {
    return emptyWeek();
  }
}

function write() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(week));
  } catch {
    // Uložit nejde – tréninky zůstanou jen v paměti.
  }
}

function readLocked() {
  try {
    return localStorage.getItem(LOCK_KEY) === '1';
  } catch {
    return false;
  }
}

// Odstraní duplicity, zachová pořadí prvního výskytu.
function unique(ids) {
  return [...new Set(ids)];
}

// Seznam cviků aktivního slotu (přímo uložené pole – mění ho jen funkce tohoto modulu).
function current() {
  return week.slots[week.active];
}

function setCurrent(ids) {
  week.slots[week.active] = ids;
}

// ===== Aktivní slot =====

// Vrací kopii, aby se pole nedalo omylem změnit mimo tento modul.
export function getPlan() {
  return [...current()];
}

export function isInPlan(id) {
  return current().includes(id);
}

// Přidá cvik na konec aktivního tréninku, nebo ho odebere, pokud už tam je.
// Vrátí nový stav (true = cvik je v tréninku).
export function togglePlan(id) {
  if (isInPlan(id)) setCurrent(current().filter((x) => x !== id));
  else current().push(id);
  write();
  return isInPlan(id);
}

export function removeFromPlan(id) {
  setCurrent(current().filter((x) => x !== id));
  write();
}

// Posune cvik o `delta` pozic (-1 = výš, +1 = níž) a vrátí jeho novou pozici (od 0).
// Na začátku/konci seznamu se nic nestane.
export function movePlanItem(id, delta) {
  const plan = current();
  const from = plan.indexOf(id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= plan.length) return from;
  [plan[from], plan[to]] = [plan[to], plan[from]]; // prohození dvou sousedů
  write();
  return to;
}

// Nahradí celý aktivní trénink (např. sdíleným tréninkem z odkazu).
export function setPlan(ids) {
  setCurrent(unique(ids));
  write();
}

export function clearPlan() {
  setPlan([]);
}

// ===== Všechny sloty =====

// Index aktivního slotu (0–3; v UI se zobrazuje jako 1–4).
export function getActive() {
  return week.active;
}

export function setActive(index) {
  if (!Number.isInteger(index) || index < 0 || index >= SLOT_COUNT) return;
  week.active = index;
  write();
}

// Kopie všech slotů: pole 4 polí ID cviků.
export function getSlots() {
  return week.slots.map((ids) => [...ids]);
}

// Celý týden { active, slots } jako kopie (pro zálohu do souboru).
export function getWeek() {
  return { active: week.active, slots: getSlots() };
}

// Import ze zálohy. mode 'replace': tréninky se nahradí zálohou.
// mode 'merge': ze zálohy se převezmou jen tréninky, které jsou v zařízení prázdné.
// knownIds = ID existujících cviků (neznámé se vynechají).
export function importWeek(data, mode, knownIds) {
  const imported = cleanWeek(data) ?? emptyWeek();
  imported.slots = imported.slots.map((ids) => ids.filter((id) => knownIds.has(id)));
  if (mode === 'replace') {
    week = imported;
  } else {
    week.slots = week.slots.map((ids, i) => (ids.length ? ids : imported.slots[i]));
  }
  write();
}

// „Nový týden“: vyprázdní všechny sloty a aktivním udělá slot 1.
export function clearWeek() {
  week = emptyWeek();
  write();
}

// Vyřadí cviky, které už v datech neexistují (např. smazaný cvik).
export function retainOnly(knownIds) {
  let changed = false;
  week.slots = week.slots.map((ids) => {
    const kept = ids.filter((id) => knownIds.has(id));
    if (kept.length !== ids.length) changed = true;
    return kept;
  });
  if (changed) write();
}

// ===== Zámek =====

export function isLocked() {
  return locked;
}

export function setLocked(value) {
  locked = value;
  try {
    if (locked) localStorage.setItem(LOCK_KEY, '1');
    else localStorage.removeItem(LOCK_KEY);
  } catch {
    // Uložit nejde – zámek platí jen do zavření stránky.
  }
}

// Zavolá `callback`, když se tréninky (nebo zámek) změní v jiné záložce téhož prohlížeče.
export function onExternalChange(callback) {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== LOCK_KEY) return;
    week = read();
    locked = readLocked();
    callback();
  });
}
