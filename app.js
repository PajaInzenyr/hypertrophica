// Vstupní bod aplikace: načte data, drží stav (vyhledávání + filtry)
// a vykresluje seznam cviků a detail cviku.

import { loadStrings, t, localized, applyStaticStrings } from './js/i18n.js';
import { EMPTY_FILTERS, filterExercises, hasActiveFilters } from './js/filters.js';

// ===== Stav aplikace =====
const state = {
  exercises: [],
  muscles: new Map(), // id svalu → objekt z muscles.json
  filters: { ...EMPTY_FILTERS },
  listScrollY: 0, // pozice v seznamu, kam se vrátit z detailu
  lastOpenedId: null,
};

// ===== Odkazy na prvky stránky =====
const $ = (id) => document.getElementById(id);
const ui = {
  status: $('status'),
  listView: $('list-view'),
  detailView: $('detail-view'),
  search: $('search-input'),
  muscle: $('filter-muscle'),
  role: $('filter-role'),
  type: $('filter-type'),
  equipment: $('filter-equipment'),
  reset: $('filter-reset'),
  count: $('result-count'),
  list: $('exercise-list'),
};

// Pomocná funkce pro vytvoření HTML prvku:
// el('li', { className: 'chip' }, 'Prsa') → <li class="chip">Prsa</li>
// Text se vkládá přes textContent, takže se nikdy nevykoná jako HTML.
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

const muscleName = (id) => localized(state.muscles.get(id)?.name) || id;
const byCzechName = (a, b) => a.label.localeCompare(b.label, 'cs');

// ===== Start =====
init();

async function init() {
  try {
    await loadStrings('cs');
    applyStaticStrings();
    ui.status.textContent = t('app.loading');

    const [muscles, exercises] = await Promise.all([
      fetchJson('./data/muscles.json'),
      fetchJson('./data/exercises.json'),
    ]);
    muscles.forEach((m) => state.muscles.set(m.id, m));
    state.exercises = exercises.sort((a, b) =>
      localized(a.name).localeCompare(localized(b.name), 'cs')
    );
  } catch (error) {
    console.error(error);
    // Pokud selhal už i18n, t() vrátí jen klíč – proto pevný český text navíc.
    ui.status.textContent = t('app.loadError') === 'app.loadError'
      ? 'Data se nepodařilo načíst.'
      : t('app.loadError');
    return;
  }

  ui.status.hidden = true;
  fillFilterOptions();
  syncFilterControls();
  bindEvents();
  renderList();
  route();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

// ===== Filtry =====
function fillSelect(select, options, anyLabel) {
  const items = anyLabel ? [{ value: '', label: anyLabel }, ...options] : options;
  select.replaceChildren(...items.map((o) => el('option', { value: o.value, textContent: o.label })));
}

function fillFilterOptions() {
  const muscles = [...state.muscles.values()]
    .map((m) => ({ value: m.id, label: localized(m.name) }))
    .sort(byCzechName);
  fillSelect(ui.muscle, muscles, t('filters.any'));

  fillSelect(ui.role, ['any', 'primary', 'secondary'].map((r) => ({ value: r, label: t(`role.${r}`) })));

  fillSelect(ui.type, ['compound', 'isolation'].map((v) => ({ value: v, label: t(`type.${v}`) })), t('filters.any'));

  // Nabídne jen vybavení, které se v datech opravdu vyskytuje.
  const equipment = [...new Set(state.exercises.flatMap((ex) => ex.equipment))]
    .map((v) => ({ value: v, label: t(`equipment.${v}`) }))
    .sort(byCzechName);
  fillSelect(ui.equipment, equipment, t('filters.any'));
}

function bindEvents() {
  ui.search.addEventListener('input', () => setFilters({ query: ui.search.value }));
  ui.muscle.addEventListener('change', () => setFilters({ muscle: ui.muscle.value }));
  ui.role.addEventListener('change', () => setFilters({ role: ui.role.value }));
  ui.type.addEventListener('change', () => setFilters({ type: ui.type.value }));
  ui.equipment.addEventListener('change', () => setFilters({ equipment: ui.equipment.value }));
  ui.reset.addEventListener('click', () => {
    setFilters({ ...EMPTY_FILTERS });
    ui.search.focus();
  });
  window.addEventListener('hashchange', route);
}

// Jediné místo, kde se mění filtry. Později sem napojíme i schéma svalů.
function setFilters(changes) {
  state.filters = { ...state.filters, ...changes };
  syncFilterControls();
  renderList();
}

// Nastaví ovládací prvky podle stavu (důležité, když filtr změní něco jiného
// než samotný prvek – např. tlačítko "Zrušit filtry").
function syncFilterControls() {
  const f = state.filters;
  if (ui.search.value !== f.query) ui.search.value = f.query;
  ui.muscle.value = f.muscle;
  ui.role.value = f.role;
  ui.type.value = f.type;
  ui.equipment.value = f.equipment;
  ui.role.disabled = !f.muscle; // zapojení má smysl jen u vybraného svalu
  ui.reset.disabled = !hasActiveFilters(f);
}

// ===== Seznam =====
function renderList() {
  const results = filterExercises(state.exercises, state.filters);
  ui.count.textContent = t('list.count', { count: results.length });

  if (results.length === 0) {
    ui.list.replaceChildren(el('li', { className: 'status', textContent: t('list.empty') }));
    return;
  }

  ui.list.replaceChildren(...results.map((ex) => {
    const meta = `${t(`type.${ex.type}`)} · ${ex.primary.map(muscleName).join(', ')}`;
    return el('li', {},
      el('a', { className: 'exercise-link', href: `#/cvik/${ex.id}` },
        el('span', { className: 'exercise-name', textContent: localized(ex.name) }),
        el('span', { className: 'exercise-meta', textContent: meta })
      )
    );
  }));
}

// ===== Přepínání pohledů podle adresy (#/ = seznam, #/cvik/<id> = detail) =====
function route() {
  const match = location.hash.match(/^#\/cvik\/([\w-]+)$/);
  if (match) {
    if (!ui.listView.hidden) state.listScrollY = window.scrollY;
    showDetail(match[1]);
  } else {
    showList();
  }
}

function showList() {
  const wasInDetail = !ui.detailView.hidden;
  ui.detailView.hidden = true;
  ui.listView.hidden = false;
  if (!wasInDetail) return;

  // Návrat z detailu: obnov pozici v seznamu a fokus na naposledy otevřený cvik.
  window.scrollTo(0, state.listScrollY);
  const link = ui.list.querySelector(`a[href="#/cvik/${state.lastOpenedId}"]`);
  link?.focus({ preventScroll: true });
}

function showDetail(id) {
  const ex = state.exercises.find((e) => e.id === id);
  state.lastOpenedId = id;
  ui.listView.hidden = true;
  ui.detailView.hidden = false;
  ui.detailView.replaceChildren(...(ex ? detailContent(ex) : [
    backLink(),
    el('p', { className: 'status', textContent: t('detail.notFound') }),
  ]));
  window.scrollTo(0, 0);
  // Fokus na nadpis, aby čtečka obrazovky oznámila nový obsah.
  ui.detailView.querySelector('h1')?.focus();
}

function backLink() {
  return el('a', { className: 'back-link', href: '#/', textContent: `← ${t('detail.back')}` });
}

function chipList(items, className = 'chip') {
  if (items.length === 0) return el('span', { textContent: t('detail.none') });
  return el('ul', { className: 'chips' },
    ...items.map((text) => el('li', { className, textContent: text }))
  );
}

function fact(label, value) {
  return [el('dt', { textContent: label }), el('dd', {}, value)];
}

function detailContent(ex) {
  const nodes = [
    backLink(),
    el('h1', { tabIndex: -1, textContent: localized(ex.name) }),
  ];
  // Anglický název jako podtitul, pokud se liší od zobrazeného.
  if (ex.name.en && ex.name.en !== localized(ex.name)) {
    nodes.push(el('p', { className: 'detail-subtitle', lang: 'en', textContent: ex.name.en }));
  }

  nodes.push(el('dl', { className: 'detail-facts' },
    ...fact(t('detail.type'), t(`type.${ex.type}`)),
    ...fact(t('detail.primary'), chipList(ex.primary.map(muscleName), 'chip chip-primary')),
    ...fact(t('detail.secondary'), chipList(ex.secondary.map(muscleName))),
    ...fact(t('detail.equipment'), chipList(ex.equipment.map((e) => t(`equipment.${e}`))))
  ));

  const description = localized(ex.description);
  if (description) {
    nodes.push(el('h2', { textContent: t('detail.description') }), el('p', { textContent: description }));
  }
  const notes = localized(ex.notes);
  if (notes) {
    nodes.push(el('h2', { textContent: t('detail.notes') }), el('p', { textContent: notes }));
  }
  return nodes;
}
