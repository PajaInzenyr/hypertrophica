// Vstupní bod aplikace: načte data, drží stav (vyhledávání + filtry)
// a vykresluje seznam cviků, detail cviku a trénink.

import { loadStrings, t, localized, applyStaticStrings } from './js/i18n.js';
import { EMPTY_FILTERS, filterExercises, hasActiveFilters } from './js/filters.js';
import { loadBodyMapSource, createBodyMap } from './js/bodymap.js';
import { isFavorite, toggleFavorite, getFavorites, onExternalChange } from './js/favorites.js';
import * as plan from './js/plan.js';
import { initThemeToggle } from './js/theme.js';

// ===== Stav aplikace =====
const state = {
  exercises: [],
  byId: new Map(), // id cviku → objekt z exercises.json
  muscles: new Map(), // id svalu → objekt z muscles.json
  filters: { ...EMPTY_FILTERS },
  view: null, // právě zobrazený pohled: 'list' | 'detail' | 'plan'
  scrollY: { list: 0, plan: 0 }, // pozice, kam se vrátit z detailu
  lastOpenedId: null,
  returnHash: '#/', // kam vede „Zpět“ z detailu (seznam, nebo trénink)
  bodyMap: null, // hlavní klikací schéma svalů
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
  favorites: $('filter-favorites'),
  reset: $('filter-reset'),
  count: $('result-count'),
  list: $('exercise-list'),
  bodyMap: $('body-map'),
  planLink: $('plan-link'),
  planCount: $('plan-count'),
  planView: $('plan-view'),
  planBack: $('plan-back'),
  planTitle: $('plan-title'),
  planIntro: $('plan-intro'),
  planList: $('plan-list'),
  planActions: $('plan-actions'),
  planFeedback: $('plan-feedback'),
  planAnnouncer: $('plan-announcer'),
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
registerServiceWorker();

// Service worker (sw.js) ukládá soubory aplikace do cache, takže funguje i offline.
// Starší prohlížeče ho nepodporují – aplikace pak běží normálně, jen bez offline režimu.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker:', error));
}

async function init() {
  try {
    await loadStrings('cs');
    applyStaticStrings();
    initThemeToggle(document.getElementById('theme-toggle'));
    ui.status.textContent = t('app.loading');

    const [muscles, exercises] = await Promise.all([
      fetchJson('./data/muscles.json'),
      fetchJson('./data/exercises.json'),
      loadBodyMapSource(),
    ]);
    muscles.forEach((m) => state.muscles.set(m.id, m));
    state.exercises = exercises.sort((a, b) =>
      localized(a.name).localeCompare(localized(b.name), 'cs')
    );
    exercises.forEach((ex) => state.byId.set(ex.id, ex));
    plan.retainOnly(new Set(state.byId.keys()));
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
  state.bodyMap = createBodyMap(ui.bodyMap, {
    getLabel: muscleName,
    // Klik na už vybraný sval filtr zruší, jinak ho nastaví.
    onSelect: (id) => setFilters({ muscle: state.filters.muscle === id ? '' : id }),
  });
  syncFilterControls();
  ui.planBack.textContent = `← ${t('detail.back')}`;
  ui.planLink.hidden = false;
  updatePlanLink();
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
  ui.favorites.addEventListener('click', () => setFilters({ favoritesOnly: !state.filters.favoritesOnly }));
  ui.reset.addEventListener('click', () => {
    setFilters({ ...EMPTY_FILTERS });
    ui.search.focus();
  });
  // Hvězdičky a tlačítka „do tréninku“ v seznamu i v detailu – jeden posluchač pro celou stránku.
  document.addEventListener('click', (event) => {
    const star = event.target.closest('.star-button');
    if (star) onStarClick(star);
    const planToggle = event.target.closest('.plan-button');
    if (planToggle) onPlanToggle(planToggle);
  });
  // Šipky a odebrání v tréninku.
  ui.planList.addEventListener('click', (event) => {
    const button = event.target.closest('.icon-button');
    if (button) onPlanItemAction(button);
  });
  // Změna tréninku v jiné záložce.
  plan.onExternalChange(afterPlanChange);
  // Změna oblíbených v jiné záložce: překresli, co je vidět.
  onExternalChange(() => {
    syncFilterControls();
    renderList();
    document.querySelectorAll('.star-button').forEach(updateStarButton);
  });
  window.addEventListener('hashchange', route);
}

// Jediné místo, kde se mění filtry (volá ho hledání, menu, schéma svalů i tlačítka).
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
  ui.favorites.setAttribute('aria-pressed', String(f.favoritesOnly));
  ui.favorites.textContent = `★ ${t('filters.favoritesOnly', { count: getFavorites().size })}`;
  state.bodyMap.setActive(f.muscle);
}

// ===== Seznam =====
function renderList() {
  const results = filterExercises(state.exercises, state.filters, getFavorites());
  ui.count.textContent = t('list.count', { count: results.length });

  if (results.length === 0) {
    const noFavorites = state.filters.favoritesOnly && getFavorites().size === 0;
    const message = noFavorites ? t('favorites.empty') : t('list.empty');
    ui.list.replaceChildren(el('li', { className: 'status', textContent: message }));
    return;
  }

  ui.list.replaceChildren(...results.map((ex) => {
    const meta = `${t(`type.${ex.type}`)} · ${ex.primary.map(muscleName).join(', ')}`;
    return el('li', { className: 'exercise-item' },
      el('a', { className: 'exercise-link', href: `#/cvik/${ex.id}` },
        el('span', { className: 'exercise-name', textContent: localized(ex.name) }),
        el('span', { className: 'exercise-meta', textContent: meta })
      ),
      planButton(ex.id),
      starButton(ex.id)
    );
  }));
}

// ===== Oblíbené (hvězdička) =====
// Obrys hvězdy; vyplnění řeší CSS podle aria-pressed.
// Velikost a barva jsou i přímo v atributech SVG: hvězdička je pak vidět,
// i kdyby prohlížeč měl v cache starší style.css (jinak by měla velikost 0×0).
const STAR_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"'
  + ' stroke-width="1.6" stroke-linejoin="round" aria-hidden="true" focusable="false">'
  + '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';

function starButton(id) {
  const button = el('button', { type: 'button', className: 'star-button' });
  button.dataset.id = id;
  button.innerHTML = STAR_SVG; // pevný text z kódu, ne z dat
  updateStarButton(button);
  return button;
}

// Nastaví stav a popisek tlačítka podle toho, zda je cvik oblíbený.
function updateStarButton(button) {
  const id = button.dataset.id;
  const name = localized(state.byId.get(id)?.name);
  const on = isFavorite(id);
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', t(on ? 'favorites.remove' : 'favorites.add', { name }));
  button.title = button.getAttribute('aria-label');
}

function onStarClick(button) {
  const id = button.dataset.id;
  toggleFavorite(id);
  // Stejný cvik může mít hvězdičku v seznamu i v detailu – aktualizuj všechny.
  document.querySelectorAll(`.star-button[data-id="${id}"]`).forEach(updateStarButton);
  syncFilterControls(); // počet v tlačítku „Jen oblíbené“

  // V režimu „jen oblíbené“ odebraný cvik zmizí ze seznamu → překreslit
  // a fokus přesunout na sousední hvězdičku, aby se uživatel klávesnicí neztratil.
  if (!state.filters.favoritesOnly) return;
  const inList = ui.list.contains(button);
  const index = [...ui.list.querySelectorAll('.star-button')].indexOf(button);
  renderList();
  if (inList) {
    const remaining = ui.list.querySelectorAll('.star-button');
    (remaining[Math.min(index, remaining.length - 1)] ?? ui.favorites).focus();
  }
}

// ===== Tlačítko „do tréninku“ (+ / ✓) =====
// Ikony se přepínají v JS (ne v CSS), aby stav byl vidět i se starším style.css v cache.
const PLAN_ICON_ADD = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"'
  + ' stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">'
  + '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>';
const PLAN_ICON_ADDED = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"'
  + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
  + '<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M8 12.5l2.8 2.8L16.5 9.5" style="stroke: var(--surface)"/></svg>';

function planButton(id) {
  const button = el('button', { type: 'button', className: 'plan-button' });
  button.dataset.id = id;
  updatePlanButton(button);
  return button;
}

// Nastaví ikonu, stav a popisek podle toho, zda je cvik v tréninku.
function updatePlanButton(button) {
  const id = button.dataset.id;
  const name = localized(state.byId.get(id)?.name);
  const on = plan.isInPlan(id);
  button.innerHTML = on ? PLAN_ICON_ADDED : PLAN_ICON_ADD; // pevný text z kódu, ne z dat
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', t(on ? 'plan.remove' : 'plan.add', { name }));
  button.title = button.getAttribute('aria-label');
}

function onPlanToggle(button) {
  plan.togglePlan(button.dataset.id);
  afterPlanChange();
}

// Po jakékoli změně tréninku překresli vše, co ho zobrazuje.
function afterPlanChange() {
  document.querySelectorAll('.plan-button').forEach(updatePlanButton);
  updatePlanLink();
  if (state.view === 'plan') renderPlan();
}

// Počet cviků v odznaku u ikony tréninku v hlavičce.
function updatePlanLink() {
  const count = plan.getPlan().length;
  ui.planCount.textContent = count > 0 ? String(count) : '';
  ui.planLink.setAttribute('aria-label', t('plan.headerLabel', { count }));
  ui.planLink.title = ui.planLink.getAttribute('aria-label');
}

// ===== Pohled Trénink =====
function showPlan(previous) {
  setView('plan');
  ui.planFeedback.textContent = '';
  renderPlan();
  if (previous === 'detail') {
    restorePosition('plan', ui.planList);
  } else {
    window.scrollTo(0, 0);
    ui.planTitle.focus();
  }
}

function renderPlan() {
  const ids = plan.getPlan();
  ui.planTitle.textContent = t('plan.title');
  ui.planIntro.textContent = t(ids.length ? 'plan.hint' : 'plan.empty');
  ui.planList.replaceChildren(...ids.map((id, index) => planItem(state.byId.get(id), index, ids.length)));
  ui.planActions.replaceChildren(...(ids.length ? [
    actionButton('button-secondary', t('plan.clear'), onClearPlan),
  ] : []));
}

function actionButton(className, text, onClick) {
  const button = el('button', { type: 'button', className, textContent: text });
  button.addEventListener('click', onClick);
  return button;
}

// Šipky a křížek (ikony obrysem, barvu bere z CSS přes currentColor).
const ICONS = {
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  remove: '<path d="M6 6l12 12M18 6L6 18"/>',
};

function iconButton(action, ex, disabled = false) {
  const labels = { up: 'plan.moveUp', down: 'plan.moveDown', remove: 'plan.remove' };
  const button = el('button', { type: 'button', className: 'icon-button', disabled });
  button.dataset.action = action;
  button.dataset.id = ex.id;
  button.setAttribute('aria-label', t(labels[action], { name: localized(ex.name) }));
  button.title = button.getAttribute('aria-label');
  button.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">'
    + ICONS[action] + '</svg>';
  return button;
}

// Číslo je jen vizuální – čtečka obrazovky pořadí zná ze seznamu <ol>.
function numberBadge(number) {
  const span = el('span', { className: 'plan-number', textContent: String(number) });
  span.setAttribute('aria-hidden', 'true');
  return span;
}

// Jedna položka tréninku: pořadí | cvik | ↑ ↓ | ×
function planItem(ex, index, total) {
  const meta = `${t(`type.${ex.type}`)} · ${ex.primary.map(muscleName).join(', ')}`;
  return el('li', { className: 'plan-item' },
    numberBadge(index + 1),
    el('a', { className: 'exercise-link', href: `#/cvik/${ex.id}` },
      el('span', { className: 'exercise-name', textContent: localized(ex.name) }),
      el('span', { className: 'exercise-meta', textContent: meta })
    ),
    el('div', { className: 'plan-move' },
      iconButton('up', ex, index === 0),
      iconButton('down', ex, index === total - 1)
    ),
    iconButton('remove', ex)
  );
}

function onPlanItemAction(button) {
  const { id, action } = button.dataset;
  const name = localized(state.byId.get(id)?.name);

  if (action === 'remove') {
    const index = plan.getPlan().indexOf(id);
    plan.removeFromPlan(id);
    afterPlanChange();
    ui.planAnnouncer.textContent = t('plan.removed', { name });
    // Fokus na křížek položky, která se posunula na místo odebrané (nebo na nadpis).
    const remaining = ui.planList.querySelectorAll('[data-action="remove"]');
    (remaining[Math.min(index, remaining.length - 1)] ?? ui.planTitle).focus();
    return;
  }

  const position = plan.movePlanItem(id, action === 'up' ? -1 : 1);
  afterPlanChange();
  ui.planAnnouncer.textContent = t('plan.moved', { name, position: position + 1 });
  // Seznam se překreslil – vrať fokus na stejnou šipku u přesunutého cviku.
  // Když už je cvik na kraji (šipka nejde použít), přesuň fokus na tu druhou.
  const same = ui.planList.querySelector(`[data-id="${id}"][data-action="${action}"]`);
  const other = ui.planList.querySelector(`[data-id="${id}"][data-action="${action === 'up' ? 'down' : 'up'}"]`);
  (same.disabled ? other : same).focus();
}

function onClearPlan() {
  if (!window.confirm(t('plan.clearConfirm'))) return;
  plan.clearPlan();
  afterPlanChange();
  ui.planFeedback.textContent = t('plan.cleared');
  ui.planTitle.focus();
}

// ===== Přepínání pohledů podle adresy =====
// #/ = seznam, #/cvik/<id> = detail cviku, #/trenink = trénink
function route() {
  const previous = state.view;
  // Zapamatuj si, kam se v seznamu / tréninku odscrollovalo, ať se tam dá vrátit.
  if (previous === 'list' || previous === 'plan') state.scrollY[previous] = window.scrollY;

  const detail = location.hash.match(/^#\/cvik\/([\w-]+)$/);
  if (detail) {
    // „Zpět“ z detailu vede tam, odkud byl detail otevřen.
    if (previous !== 'detail') state.returnHash = previous === 'plan' ? '#/trenink' : '#/';
    showDetail(detail[1]);
  } else if (/^#\/trenink$/.test(location.hash)) {
    showPlan(previous);
  } else {
    showList(previous);
  }
}

// Zobrazí jeden pohled a ostatní skryje.
function setView(name) {
  state.view = name;
  ui.listView.hidden = name !== 'list';
  ui.detailView.hidden = name !== 'detail';
  ui.planView.hidden = name !== 'plan';
  // Zvýrazní ikonu tréninku v hlavičce, když je trénink otevřený.
  if (name === 'plan') ui.planLink.setAttribute('aria-current', 'page');
  else ui.planLink.removeAttribute('aria-current');
}

// Návrat z detailu: obnov pozici a fokus na naposledy otevřený cvik.
function restorePosition(view, container) {
  window.scrollTo(0, state.scrollY[view]);
  const link = container.querySelector(`a[href="#/cvik/${state.lastOpenedId}"]`);
  link?.focus({ preventScroll: true });
}

function showList(previous) {
  setView('list');
  if (previous === 'detail') restorePosition('list', ui.list);
  else if (previous === 'plan') window.scrollTo(0, state.scrollY.list);
}

function showDetail(id) {
  const ex = state.byId.get(id);
  state.lastOpenedId = id;
  setView('detail');
  ui.detailView.replaceChildren(...(ex ? detailContent(ex) : [
    backLink(),
    el('p', { className: 'status', textContent: t('detail.notFound') }),
  ]));
  window.scrollTo(0, 0);
  // Fokus na nadpis, aby čtečka obrazovky oznámila nový obsah.
  ui.detailView.querySelector('h1')?.focus();
}

function backLink() {
  const toPlan = state.returnHash !== '#/';
  const text = t(toPlan ? 'detail.backToPlan' : 'detail.back');
  return el('a', { className: 'back-link', href: state.returnHash, textContent: `← ${text}` });
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
    el('div', { className: 'detail-heading' },
      el('h1', { tabIndex: -1, textContent: localized(ex.name) }),
      el('div', { className: 'detail-actions' }, planButton(ex.id), starButton(ex.id))
    ),
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
  nodes.push(engagementMap(ex));

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

// Malé schéma v detailu: primární svaly plnou barvou, sekundární světlejší.
function engagementMap(ex) {
  const container = el('div', { className: 'body-map-figure' });
  createBodyMap(container).setEngagement(ex.primary, ex.secondary);
  return el('figure', { className: 'body-map' },
    el('h2', { textContent: t('bodymap.engagement') }),
    container,
    el('ul', { className: 'legend' },
      el('li', { textContent: t('bodymap.legendPrimary') }),
      el('li', { className: 'legend-secondary', textContent: t('bodymap.legendSecondary') })
    )
  );
}
