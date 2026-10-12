// Oblíbené cviky. Ukládají se do localStorage prohlížeče (pod klíčem hw.favorites
// jako pole ID cviků), takže přežijí zavření stránky – ale jen na tomto zařízení
// a v tomto prohlížeči.
//
// localStorage nemusí být dostupné (anonymní okno, zakázaná data webu...).
// Proto je každý přístup v try/catch: oblíbené pak fungují aspoň do zavření stránky.

const STORAGE_KEY = 'hw.favorites';

let favorites = new Set(read());

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function write() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
  } catch {
    // Uložit nejde – oblíbené zůstanou jen v paměti.
  }
}

export function isFavorite(id) {
  return favorites.has(id);
}

// Přepne cvik mezi oblíbenými a vrátí nový stav (true = je oblíbený).
export function toggleFavorite(id) {
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  write();
  return favorites.has(id);
}

export function getFavorites() {
  return favorites;
}

// Zavolá `callback`, když se oblíbené změní v jiné záložce téhož prohlížeče.
export function onExternalChange(callback) {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    favorites = new Set(read());
    callback();
  });
}
