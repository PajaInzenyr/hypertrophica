// Trénink = seřazený seznam ID cviků (jen pořadí, žádné série ani váhy).
// Ukládá se do localStorage prohlížeče pod klíčem hw.plan jako pole ID,
// takže přežije zavření stránky – ale jen na tomto zařízení a v tomto prohlížeči.
// Každý cvik je v tréninku nejvýš jednou.
//
// Stejně jako u oblíbených je každý přístup k localStorage v try/catch:
// když není dostupné, trénink funguje aspoň do zavření stránky.

const STORAGE_KEY = 'hw.plan';

let plan = read();

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? unique(parsed.filter((id) => typeof id === 'string')) : [];
  } catch {
    return [];
  }
}

function write() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // Uložit nejde – trénink zůstane jen v paměti.
  }
}

// Odstraní duplicity, zachová pořadí prvního výskytu.
function unique(ids) {
  return [...new Set(ids)];
}

// Vrací kopii, aby se pole nedalo omylem změnit mimo tento modul.
export function getPlan() {
  return [...plan];
}

export function isInPlan(id) {
  return plan.includes(id);
}

// Přidá cvik na konec tréninku, nebo ho odebere, pokud už tam je.
// Vrátí nový stav (true = cvik je v tréninku).
export function togglePlan(id) {
  if (plan.includes(id)) plan = plan.filter((x) => x !== id);
  else plan.push(id);
  write();
  return plan.includes(id);
}

export function removeFromPlan(id) {
  plan = plan.filter((x) => x !== id);
  write();
}

// Posune cvik o `delta` pozic (-1 = výš, +1 = níž) a vrátí jeho novou pozici (od 0).
// Na začátku/konci seznamu se nic nestane.
export function movePlanItem(id, delta) {
  const from = plan.indexOf(id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= plan.length) return from;
  [plan[from], plan[to]] = [plan[to], plan[from]]; // prohození dvou sousedů
  write();
  return to;
}

// Nahradí celý trénink (např. sdíleným tréninkem z odkazu).
export function setPlan(ids) {
  plan = unique(ids);
  write();
}

export function clearPlan() {
  setPlan([]);
}

// Vyřadí cviky, které už v datech neexistují (např. smazaný cvik).
export function retainOnly(knownIds) {
  const kept = plan.filter((id) => knownIds.has(id));
  if (kept.length !== plan.length) setPlan(kept);
}

// Zavolá `callback`, když se trénink změní v jiné záložce téhož prohlížeče.
export function onExternalChange(callback) {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    plan = read();
    callback();
  });
}
