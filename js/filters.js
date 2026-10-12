// Vyhledávání a filtrování cviků. Neobsahuje nic, co by sahalo na stránku (DOM),
// jen pracuje s daty – proto se dá snadno znovu použít (schéma svalů, oblíbené).

// Výchozí (prázdný) stav filtrů. Prázdný řetězec = filtr není aktivní.
export const EMPTY_FILTERS = Object.freeze({
  query: '',
  muscle: '',
  role: 'any', // 'any' | 'primary' | 'secondary'
  type: '',
  equipment: '',
});

// Převede text na tvar vhodný pro porovnání: malá písmena, bez diakritiky.
// "Dřep" → "drep", "ŠIKMÉ" → "sikme".
// normalize('NFD') rozloží "ř" na "r" + háček a regulární výraz háček odstraní.
export function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function matchesQuery(exercise, query) {
  if (!query) return true;
  // Hledá v českém i anglickém názvu, takže funguje "bench" i "tlaky".
  const haystack = normalize(Object.values(exercise.name).join(' '));
  // Každé slovo dotazu musí být obsaženo (pořadí nehraje roli).
  return normalize(query).split(/\s+/).every((word) => haystack.includes(word));
}

function matchesMuscle(exercise, muscle, role) {
  if (!muscle) return true;
  const inPrimary = exercise.primary.includes(muscle);
  const inSecondary = exercise.secondary.includes(muscle);
  if (role === 'primary') return inPrimary;
  if (role === 'secondary') return inSecondary;
  return inPrimary || inSecondary;
}

// Vrátí cviky, které splňují všechny aktivní filtry zároveň (AND).
export function filterExercises(exercises, filters) {
  return exercises.filter(
    (ex) =>
      matchesQuery(ex, filters.query) &&
      matchesMuscle(ex, filters.muscle, filters.role) &&
      (!filters.type || ex.type === filters.type) &&
      (!filters.equipment || ex.equipment.includes(filters.equipment))
  );
}

export function hasActiveFilters(filters) {
  return Object.keys(EMPTY_FILTERS).some((key) => filters[key] !== EMPTY_FILTERS[key]);
}
