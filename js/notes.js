// Vlastní poznámky ke cvikům (např. „sedák 4, opěrka 2, úzký úchop“).
// Na rozdíl od sekce Tipy (pole "notes" v data/exercises.json, píše ji autor obsahu)
// je píše uživatel přímo v aplikaci a ukládají se jen v tomto prohlížeči.
//
// Ukládá se do localStorage pod klíčem hw.notes:
//   { "bench-press-barbell": { "text": "Úchop o palec širší", "updatedAt": "2026-11-20T18:22:05.000Z" } }
// Jedna poznámka na cvik. updatedAt = čas poslední úpravy; podle něj se při sloučení
// zálohy pozná, která ze dvou poznámek ke stejnému cviku je novější.
//
// Stejně jako u oblíbených je každý přístup k localStorage v try/catch:
// když není dostupné, poznámky fungují aspoň do zavření stránky.

const STORAGE_KEY = 'hw.notes';

// Nejvyšší počet znaků jedné poznámky (stejný limit má textové pole v detailu cviku).
export const MAX_LENGTH = 1000;

let notes = read();

// Text poznámky: jednotné konce řádků, bez mezer a prázdných řádků na začátku a konci.
function cleanText(text) {
  return typeof text === 'string' ? text.replace(/\r\n?/g, '\n').trim() : '';
}

// Z libovolné hodnoty (localStorage nebo záloha) udělá platné poznámky; neplatné vynechá.
// knownIds = ID existujících cviků (při importu zálohy); bez něj se ID nekontrolují.
export function cleanNotes(stored, knownIds = null) {
  const result = {};
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return result;
  for (const [exerciseId, note] of Object.entries(stored)) {
    if (knownIds && !knownIds.has(exerciseId)) continue;
    const text = cleanText(note?.text);
    if (!text || text.length > MAX_LENGTH) continue;
    // Chybějící nebo nesmyslný čas = „nejstarší možný“: při sloučení vyhraje jakákoli jiná poznámka.
    const updatedAt = typeof note.updatedAt === 'string' && !Number.isNaN(Date.parse(note.updatedAt))
      ? note.updatedAt
      : new Date(0).toISOString();
    result[exerciseId] = { text, updatedAt };
  }
  return result;
}

function read() {
  try {
    return cleanNotes(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return {};
  }
}

function write() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Uložit nejde – poznámky zůstanou jen v paměti.
  }
}

// ===== Čtení =====

// Text poznámky ke cviku, nebo '' když poznámka není.
export function getNote(exerciseId) {
  return notes[exerciseId]?.text ?? '';
}

export function hasNote(exerciseId) {
  return Boolean(notes[exerciseId]);
}

// Všechny poznámky jako kopie (pro zálohu do souboru).
export function getAll() {
  return JSON.parse(JSON.stringify(notes));
}

// ===== Zápis =====

// Uloží poznámku a vrátí uložený (upravený) text. Prázdný text poznámku smaže a vrátí ''.
// Text delší než MAX_LENGTH se zkrátí (textové pole delší text stejně nedovolí).
export function setNote(exerciseId, text) {
  const clean = cleanText(text).slice(0, MAX_LENGTH).trim();
  if (clean) {
    notes[exerciseId] = { text: clean, updatedAt: new Date().toISOString() };
  } else {
    delete notes[exerciseId];
  }
  write();
  return clean;
}

// Import ze zálohy. Vrátí počet přidaných nebo změněných poznámek.
// mode 'replace': poznámky se nahradí zálohou.
// mode 'merge': poznámky ze zálohy se přidají; u cviku, který má poznámku v zařízení
// i v záloze, zůstane ta novější (podle updatedAt).
export function importNotes(data, mode, knownIds) {
  const imported = cleanNotes(data, knownIds);
  let changed = 0;
  if (mode === 'replace') {
    changed = Object.keys(imported).length;
    notes = imported;
  } else {
    for (const [exerciseId, note] of Object.entries(imported)) {
      const local = notes[exerciseId];
      if (local && Date.parse(local.updatedAt) >= Date.parse(note.updatedAt)) continue;
      if (local?.text === note.text) continue; // stejný text, jen jiný čas – nic se nemění
      notes[exerciseId] = note;
      changed += 1;
    }
  }
  write();
  return changed;
}

// Zavolá `callback`, když se poznámky změní v jiné záložce téhož prohlížeče.
export function onExternalChange(callback) {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    notes = read();
    callback();
  });
}
