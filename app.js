// Vstupní bod aplikace: načte data, drží stav (vyhledávání + filtry)
// a vykresluje seznam cviků, detail cviku, tréninky 1–4 a týdenní souhrn.

import { loadStrings, t, localized, applyStaticStrings, currentLocale, preferredLang, initLanguage } from './js/i18n.js';
import { EMPTY_FILTERS, filterExercises, hasActiveFilters } from './js/filters.js';
import { loadBodyMapSource, createBodyMap } from './js/bodymap.js';
import { isFavorite, toggleFavorite, getFavorites, replaceFavorites, onExternalChange } from './js/favorites.js';
import * as plan from './js/plan.js';
import { initTheme } from './js/theme.js';
import * as log from './js/log.js';
import * as backup from './js/backup.js';
import * as body from './js/body.js';

// ===== Stav aplikace =====
const state = {
  exercises: [],
  byId: new Map(), // id cviku → objekt z exercises.json
  muscles: new Map(), // id svalu → objekt z muscles.json
  filters: { ...EMPTY_FILTERS },
  view: null, // právě zobrazený pohled: 'list' | 'detail' | 'plan' | 'history' | 'settings' | 'body'
  scrollY: { list: 0, plan: 0, history: 0 }, // pozice, kam se vrátit z detailu
  lastOpenedId: null,
  returnHash: '#/', // kam vede „Zpět“ z detailu (seznam, trénink, nebo historie)
  planHash: '#/trenink', // adresa naposledy zobrazeného tréninku (vlastní, sdílený, nebo Týden)
  sharedPlan: null, // ID cviků ze sdíleného odkazu; null = zobrazuje se vlastní trénink
  showWeek: false, // true = v pohledu Trénink je otevřená záložka Týden (souhrn tréninků 1–4)
  bodyMap: null, // hlavní klikací schéma svalů
  planMap: null, // schéma svalů zapojených v tréninku (jen pro čtení)
  historyDays: 0, // kolik dní se v historii zobrazuje (tlačítko „Zobrazit starší“ přidává)
  historyDates: [], // dny se sériemi, nejnovější první ("2026-10-13", …)
  historySetCounts: new Map(), // den → počet sérií (pro kalendář)
  calendarMonth: null, // měsíc zobrazený v kalendáři historie: { year, month } (month 0–11)
  bodyRecords: [], // měření (hmotnost a míry) od nejstaršího dne
  bodyMetric: 'weightKg', // míra zobrazená v grafu v pohledu Tělo
  bodyRange: 'all', // období grafu: '3m' | '1y' | 'all'
  bodyItems: 0, // kolik měření se v seznamu zobrazuje (tlačítko „Zobrazit starší“ přidává)
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
  favoritesList: $('favorites-list'),
  bodyMap: $('body-map'),
  planLink: $('plan-link'),
  planCount: $('plan-count'),
  planView: $('plan-view'),
  planBack: $('plan-back'),
  planTabs: $('plan-tabs'),
  planTitle: $('plan-title'),
  planLock: $('plan-lock'),
  planIntro: $('plan-intro'),
  planList: $('plan-list'),
  planMap: $('plan-map'),
  planMapFigure: $('plan-map-figure'),
  planMapHeading: $('plan-map-heading'),
  planMapSummary: $('plan-map-summary'),
  planLegendPrimary: $('plan-legend-primary'),
  planLegendSecondary: $('plan-legend-secondary'),
  weekSummary: $('week-summary'),
  planActions: $('plan-actions'),
  planFeedback: $('plan-feedback'),
  planAnnouncer: $('plan-announcer'),
  historyLink: $('history-link'),
  historyView: $('history-view'),
  historyBack: $('history-back'),
  historyTitle: $('history-title'),
  historyIntro: $('history-intro'),
  historyList: $('history-list'),
  historyMore: $('history-more'),
  calendarPrev: $('calendar-prev'),
  calendarNext: $('calendar-next'),
  calendarMonth: $('calendar-month'),
  calendarWeekdays: $('calendar-weekdays'),
  calendarDays: $('calendar-days'),
  settingsLink: $('settings-link'),
  settingsView: $('settings-view'),
  settingsBack: $('settings-back'),
  settingsTitle: $('settings-title'),
  backupExport: $('backup-export'),
  backupExportCsv: $('backup-export-csv'),
  backupExportBodyCsv: $('backup-export-body-csv'),
  backupImport: $('backup-import'),
  backupFile: $('backup-file'),
  backupConfirm: $('backup-confirm'),
  backupFeedback: $('backup-feedback'),
  bodyLink: $('body-link'),
  bodyView: $('body-view'),
  bodyBack: $('body-back'),
  bodyTitle: $('body-title'),
  bodyIntro: $('body-intro'),
  bodyForm: $('body-form'),
  bodyFeedback: $('body-feedback'),
  bodyLatestSection: $('body-latest-section'),
  bodyLatest: $('body-latest'),
  bodyChart: $('body-chart'),
  bodyChartTitle: $('body-chart-title'),
  bodyRange: $('body-range'),
  bodyChartFigure: $('body-chart-figure'),
  bodyChartNote: $('body-chart-note'),
  bodyListSection: $('body-list-section'),
  bodyList: $('body-list'),
  bodyMore: $('body-more'),
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
const byName = (a, b) => a.label.localeCompare(b.label, currentLocale());

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
    // Jazyk podle volby v Nastavení, jinak podle prohlížeče. Když se soubor
    // s překladem nepodaří načíst, zkusí se čeština.
    await loadStrings(preferredLang()).catch(() => loadStrings('cs'));
    applyStaticStrings();
    initTheme(document.getElementById('theme-options'));
    initLanguage(document.getElementById('language-options'));
    ui.status.textContent = t('app.loading');

    const [muscles, exercises] = await Promise.all([
      fetchJson('./data/muscles.json'),
      fetchJson('./data/exercises.json'),
      loadBodyMapSource(),
    ]);
    muscles.forEach((m) => state.muscles.set(m.id, m));
    state.exercises = exercises.sort((a, b) =>
      localized(a.name).localeCompare(localized(b.name), currentLocale())
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
  state.planMap = createBodyMap(ui.planMapFigure); // bez onSelect = neklikací kopie
  syncFilterControls();
  ui.planBack.textContent = `← ${t('detail.back')}`;
  ui.historyBack.textContent = `← ${t('detail.back')}`;
  ui.historyLink.setAttribute('aria-label', t('history.headerLabel'));
  ui.historyLink.title = t('history.headerLabel');
  ui.historyLink.hidden = false;
  ui.calendarPrev.setAttribute('aria-label', t('calendar.prev'));
  ui.calendarNext.setAttribute('aria-label', t('calendar.next'));
  renderCalendarWeekdays();
  ui.settingsBack.textContent = `← ${t('detail.back')}`;
  ui.settingsLink.setAttribute('aria-label', t('settings.headerLabel'));
  ui.settingsLink.title = t('settings.headerLabel');
  ui.settingsLink.hidden = false;
  ui.bodyBack.textContent = `← ${t('detail.back')}`;
  ui.bodyLink.setAttribute('aria-label', t('body.headerLabel'));
  ui.bodyLink.title = t('body.headerLabel');
  ui.bodyLink.hidden = false;
  createBodyForm();
  createBodyRange();
  createPlanTabs();
  ui.planLink.hidden = false;
  updatePlanLink();
  bindEvents();
  renderList();
  renderFavorites();
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
    .sort(byName);
  fillSelect(ui.muscle, muscles, t('filters.any'));

  fillSelect(ui.role, ['any', 'primary', 'secondary'].map((r) => ({ value: r, label: t(`role.${r}`) })));

  fillSelect(ui.type, ['compound', 'isolation'].map((v) => ({ value: v, label: t(`type.${v}`) })), t('filters.any'));

  // Nabídne jen vybavení, které se v datech opravdu vyskytuje.
  const equipment = [...new Set(state.exercises.flatMap((ex) => ex.equipment))]
    .map((v) => ({ value: v, label: t(`equipment.${v}`) }))
    .sort(byName);
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
  ui.planLock.addEventListener('click', onToggleLock);
  ui.planTabs.addEventListener('click', onPlanTabClick);
  // Klik na vynechanou partii v souhrnu týdne → seznam cviků na tuto partii.
  ui.weekSummary.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-muscle]');
    if (chip) showMuscleExercises(chip.dataset.muscle);
  });
  // Změna tréninku v jiné záložce.
  plan.onExternalChange(afterPlanChange);
  // Změna oblíbených v jiné záložce: překresli, co je vidět.
  onExternalChange(() => {
    syncFilterControls();
    renderList();
    renderFavorites();
    document.querySelectorAll('.star-button').forEach(updateStarButton);
  });
  ui.backupExport.addEventListener('click', onExportBackup);
  ui.backupExportCsv.addEventListener('click', onExportCsv);
  ui.backupExportBodyCsv.addEventListener('click', onExportBodyCsv);
  ui.backupImport.addEventListener('click', () => ui.backupFile.click());
  ui.backupFile.addEventListener('change', onBackupFileChosen);
  ui.historyMore.addEventListener('click', () => {
    state.historyDays += HISTORY_PAGE;
    renderHistory();
  });
  ui.calendarPrev.addEventListener('click', () => shiftCalendarMonth(-1));
  ui.calendarNext.addEventListener('click', () => shiftCalendarMonth(1));
  ui.bodyForm.addEventListener('submit', onBodySubmit);
  ui.bodyLatest.addEventListener('click', onBodyTileClick);
  ui.bodyList.addEventListener('click', onBodyListClick);
  ui.bodyMore.addEventListener('click', () => {
    state.bodyItems += BODY_PAGE;
    renderBodyList();
  });
  // Graf se kreslí v pixelech podle šířky prvku – po změně velikosti okna (otočení mobilu) se překreslí.
  window.addEventListener('resize', () => {
    if (state.view === 'body') requestAnimationFrame(renderBodyChart);
  });
  document.addEventListener('click', onDetailBackgroundClick);
  document.addEventListener('keydown', onDetailEscape);
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

  ui.list.replaceChildren(...results.map(exerciseItem));
}

// Jedna položka seznamu: odkaz na detail + tlačítko „do tréninku“ + hvězdička.
function exerciseItem(ex) {
  const meta = `${t(`type.${ex.type}`)} · ${ex.primary.map(muscleName).join(', ')}`;
  return el('li', { className: 'exercise-item' },
    el('a', { className: 'exercise-link', href: `#/cvik/${ex.id}` },
      el('span', { className: 'exercise-name', textContent: localized(ex.name) }),
      el('span', { className: 'exercise-meta', textContent: meta })
    ),
    planButton(ex.id),
    starButton(ex.id)
  );
}

// Panel oblíbených (na PC vpravo od seznamu). Ukazuje vždy všechny oblíbené cviky
// bez ohledu na filtry, seřazené stejně jako hlavní seznam (podle názvu).
function renderFavorites() {
  const favorites = getFavorites();
  const items = state.exercises.filter((ex) => favorites.has(ex.id));
  if (items.length === 0) {
    ui.favoritesList.replaceChildren(el('li', { className: 'status', textContent: t('favorites.panelEmpty') }));
    return;
  }
  ui.favoritesList.replaceChildren(...items.map(exerciseItem));
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

  // Panel oblíbených: překreslit. Když se hvězdička klikla přímo v panelu (cvik z něj zmizí),
  // přesune se fokus na sousední hvězdičku v panelu, nebo na tlačítko „Oblíbené“, když je panel prázdný.
  const inPanel = ui.favoritesList.contains(button);
  const panelIndex = [...ui.favoritesList.querySelectorAll('.star-button')].indexOf(button);
  renderFavorites();
  if (inPanel) {
    const remaining = ui.favoritesList.querySelectorAll('.star-button');
    const next = remaining[Math.min(panelIndex, remaining.length - 1)];
    if (next) next.focus();
    else ui.favorites.focus();
  }

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
  // Zamčený trénink: cvik, který v něm je, nejde odebrat ani tady (✓ zůstane vidět, ale nereaguje).
  const lockedOut = on && plan.isLocked();
  button.innerHTML = on ? PLAN_ICON_ADDED : PLAN_ICON_ADD; // pevný text z kódu, ne z dat
  button.disabled = lockedOut;
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label',
    t(lockedOut ? 'plan.lockedRemove' : on ? 'plan.remove' : 'plan.add', { name }));
  button.title = button.getAttribute('aria-label');
}

function onPlanToggle(button) {
  if (button.disabled) return;
  plan.togglePlan(button.dataset.id);
  afterPlanChange();
}

// Číslo aktivního tréninku tak, jak ho vidí uživatel (1–4).
const slotNumber = () => plan.getActive() + 1;

// Po jakékoli změně tréninku překresli vše, co ho zobrazuje.
function afterPlanChange() {
  document.querySelectorAll('.plan-button').forEach(updatePlanButton);
  updatePlanLink();
  if (state.view === 'plan') renderPlan();
}

// Počet cviků v odznaku u ikony tréninku v hlavičce.
// Ukazuje aktivní trénink (ten, do kterého přidává tlačítko ⊕).
function updatePlanLink() {
  const count = plan.getPlan().length;
  ui.planCount.textContent = count > 0 ? String(count) : '';
  ui.planLink.setAttribute('aria-label', t('plan.headerLabel', { count, number: slotNumber() }));
  ui.planLink.title = ui.planLink.getAttribute('aria-label');
}

// ===== Zámek tréninku =====
// Během cvičení se snadno omylem klepne na šipku nebo křížek. Zamčený trénink
// proto šipky, křížky ani „Vymazat trénink“ vůbec nezobrazuje.
const LOCK_ICON_CLOSED = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">'
  + '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
// Otevřený zámek: oblouk třmenu je vychýlený doprava nahoru.
const LOCK_ICON_OPEN = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">'
  + '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.75-1.4"/></svg>';

function updateLockButton() {
  const locked = plan.isLocked();
  ui.planLock.innerHTML = locked ? LOCK_ICON_CLOSED : LOCK_ICON_OPEN; // pevný text z kódu
  ui.planLock.setAttribute('aria-pressed', String(locked));
  ui.planLock.setAttribute('aria-label', t(locked ? 'plan.unlock' : 'plan.lock'));
  ui.planLock.title = ui.planLock.getAttribute('aria-label');
}

function onToggleLock() {
  plan.setLocked(!plan.isLocked());
  afterPlanChange(); // překreslí trénink i tlačítka ⊕/✓ v seznamu
  ui.planAnnouncer.textContent = t(plan.isLocked() ? 'plan.lockedOn' : 'plan.lockedOff');
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
  renderPlanTabs();
  if (state.sharedPlan) {
    renderSharedPlan(state.sharedPlan);
    return;
  }
  if (state.showWeek) {
    renderWeek();
    return;
  }
  const ids = plan.getPlan();
  const locked = plan.isLocked();
  const number = slotNumber();
  ui.planTitle.textContent = t('plan.title', { number });
  ui.planList.hidden = false;
  ui.weekSummary.hidden = true;
  // Zámek má smysl jen u neprázdného tréninku.
  ui.planLock.hidden = ids.length === 0;
  updateLockButton();
  ui.planIntro.textContent = t(!ids.length ? 'plan.empty' : locked ? 'plan.lockedHint' : 'plan.hint', { number });
  ui.planList.replaceChildren(...ids.map((id, index) => planItem(state.byId.get(id), index, ids.length, !locked)));
  updateDoneCounts();
  renderPlanMap(ids);
  if (ids.length === 0) {
    ui.planActions.replaceChildren();
    return;
  }
  ui.planActions.replaceChildren(
    // Sdílet přes systémovou nabídku (WhatsApp, Messenger…) umí hlavně mobilní prohlížeče.
    ...(navigator.share ? [actionButton('button-primary', t('plan.share'), onSharePlan)] : []),
    actionButton('button-secondary', t('plan.copyLink'), onCopyPlanLink),
    ...(locked ? [] : [actionButton('button-secondary', t('plan.clear'), onClearPlan)])
  );
}

// Náhled tréninku, který přišel odkazem: jen pořadí, bez úprav; lze ho uložit jako vlastní.
function renderSharedPlan(ids) {
  ui.planTitle.textContent = t('plan.sharedTitle');
  ui.planLock.hidden = true; // sdílený náhled se stejně nedá upravovat
  ui.planList.hidden = false;
  ui.weekSummary.hidden = true;
  ui.planIntro.textContent = t(ids.length ? 'plan.sharedIntro' : 'plan.sharedEmpty');
  ui.planList.replaceChildren(...ids.map((id, index) => planItem(state.byId.get(id), index, ids.length, false)));
  renderPlanMap(ids);
  ui.planActions.replaceChildren(
    ...(ids.length ? [actionButton('button-primary', t('plan.import', { number: slotNumber() }), onImportPlan)] : []),
    el('a', { className: 'button-secondary', href: '#/', textContent: t('plan.close') })
  );
}

// Počet cviků, které sval zapojují: { primary: n, secondary: n } pro každé ID svalu.
// Cvik zařazený ve více trénincích se počítá v každém z nich.
function engagementCounts(exercises) {
  const counts = new Map();
  const add = (id, role) => {
    const entry = counts.get(id) ?? { primary: 0, secondary: 0 };
    entry[role] += 1;
    counts.set(id, entry);
  };
  exercises.forEach((ex) => {
    ex.primary.forEach((id) => add(id, 'primary'));
    ex.secondary.forEach((id) => add(id, 'secondary'));
  });
  return counts;
}

// Celkový počet cviků na sval (primárně i sekundárně) → číslo na schématu.
const totals = (counts) => new Map([...counts].map(([id, c]) => [id, c.primary + c.secondary]));

// Text „Biceps (2), Prsa (3)“ pro čtečky obrazovky (SVG je pro ně skryté).
function muscleListText(ids, total) {
  return ids
    .map((id) => ({ label: muscleName(id), count: total.get(id) ?? 0 }))
    .sort(byName)
    .map(({ label, count }) => `${label} (${count})`)
    .join(', ');
}

// Schéma pod seznamem: které partie trénink procvičí.
// Sval, který je u některého cviku primární, je zvýrazněn plnou barvou;
// sval zapojený jen sekundárně (u žádného cviku není primární) světlejší.
function renderPlanMap(ids) {
  ui.planMap.hidden = ids.length === 0;
  if (ids.length === 0) return;
  const counts = engagementCounts(ids.map((id) => state.byId.get(id)));
  const primary = [...counts.keys()].filter((id) => counts.get(id).primary > 0);
  const secondary = [...counts.keys()].filter((id) => counts.get(id).primary === 0);
  const total = totals(counts);
  state.planMap.setEngagement(primary, secondary);
  state.planMap.setCounts(total);
  ui.planMapHeading.textContent = t('plan.mapHeading');
  ui.planLegendPrimary.textContent = t('bodymap.legendPrimary');
  ui.planLegendSecondary.textContent = t('bodymap.legendSecondary');
  ui.planMapSummary.textContent = [
    t('plan.mapPrimary', { list: muscleListText(primary, total) }),
    secondary.length ? t('plan.mapSecondary', { list: muscleListText(secondary, total) }) : '',
  ].join(' ').trim();
}

// ===== Přepínač tréninků 1–4 a Týden =====
// Tlačítka se vytvoří jednou a pak se jim jen mění stav – fokus tak po klepnutí zůstane na místě.
function createPlanTabs() {
  const slots = Array.from({ length: plan.SLOT_COUNT }, (_, index) => {
    const button = el('button', { type: 'button', className: 'plan-tab' },
      el('span', { className: 'plan-tab-number', textContent: String(index + 1) }),
      el('span', { className: 'plan-tab-count' })
    );
    button.dataset.slot = String(index);
    return button;
  });
  const weekTab = el('a', { className: 'plan-tab plan-tab-week', href: '#/tyden', textContent: t('week.tabWeek') });
  ui.planTabs.replaceChildren(...slots, weekTab);
}

// Zvýrazní otevřenou záložku a doplní počty cviků v jednotlivých trénincích.
function renderPlanTabs() {
  ui.planTabs.hidden = Boolean(state.sharedPlan);
  const slots = plan.getSlots();
  // Počet cviků v nejdelším tréninku (u sdíleného tréninku jeho délka). Podle něj CSS
  // na PC spočítá svislou pozici obsahu, aby se při přepínání záložek neposouval.
  const maxCount = state.sharedPlan ? state.sharedPlan.length : Math.max(...slots.map((s) => s.length));
  ui.planView.style.setProperty('--plan-max', String(maxCount));
  ui.planTabs.querySelectorAll('[data-slot]').forEach((button) => {
    const index = Number(button.dataset.slot);
    const count = slots[index].length;
    const current = !state.showWeek && index === plan.getActive();
    button.querySelector('.plan-tab-count').textContent = count > 0 ? String(count) : '';
    button.setAttribute('aria-label', t('week.tab', { number: index + 1, count }));
    if (current) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
    // V Týdnu orámuj aktivní trénink – do něj přidává tlačítko ⊕.
    button.classList.toggle('is-active-slot', state.showWeek && index === plan.getActive());
  });
  const weekTab = ui.planTabs.querySelector('.plan-tab-week');
  if (state.showWeek) weekTab.setAttribute('aria-current', 'page');
  else weekTab.removeAttribute('aria-current');
}

// Klepnutí na 1–4: tento trénink se stane aktivním (do něj přidává ⊕) a zobrazí se.
function onPlanTabClick(event) {
  const button = event.target.closest('[data-slot]');
  if (!button) return;
  plan.setActive(Number(button.dataset.slot));
  ui.planFeedback.textContent = '';
  if (location.hash !== '#/trenink') {
    location.hash = '#/trenink'; // z Týdne přepne adresu; překreslí route()
  }
  afterPlanChange(); // tlačítka ⊕/✓ a ikona v hlavičce teď patří jinému tréninku
}

// ===== Týden: souhrn tréninků 1–4 =====
// Partie je „zapojená“, když ji za týden zapojuje aspoň 1 cvik primárně
// nebo aspoň 2 cviky sekundárně. Jen 1 sekundární cvik = „nedostatečně“.
const WEEK_MIN_PRIMARY = 1;
const WEEK_MIN_SECONDARY = 2;

function muscleStatus(count) {
  if (!count) return 'missed';
  if (count.primary >= WEEK_MIN_PRIMARY || count.secondary >= WEEK_MIN_SECONDARY) return 'trained';
  return 'partial';
}

function renderWeek() {
  const exercises = plan.getSlots().flat().map((id) => state.byId.get(id));
  const locked = plan.isLocked();
  ui.planTitle.textContent = t('week.title');
  ui.planLock.hidden = exercises.length === 0;
  updateLockButton();
  ui.planIntro.textContent = t(exercises.length ? 'week.intro' : 'week.empty');
  ui.planList.hidden = true;
  ui.planList.replaceChildren();

  ui.planMap.hidden = exercises.length === 0;
  ui.weekSummary.hidden = exercises.length === 0;
  if (exercises.length === 0) {
    ui.weekSummary.replaceChildren();
    ui.planActions.replaceChildren();
    return;
  }

  const counts = engagementCounts(exercises);
  const groups = { trained: [], partial: [], missed: [] };
  [...state.muscles.keys()].forEach((id) => groups[muscleStatus(counts.get(id))].push(id));
  const total = totals(counts);

  // Schéma: zapojené plnou barvou, nedostatečně světlejší, vynechané bez barvy.
  state.planMap.setEngagement(groups.trained, groups.partial);
  state.planMap.setCounts(total);
  ui.planMapHeading.textContent = t('week.mapHeading');
  ui.planLegendPrimary.textContent = t('week.legendTrained');
  ui.planLegendSecondary.textContent = t('week.legendPartial');
  ui.planMapSummary.textContent = [
    groups.trained.length ? t('week.mapTrained', { list: muscleListText(groups.trained, total) }) : '',
    groups.partial.length ? t('week.mapPartial', { list: muscleListText(groups.partial, total) }) : '',
    groups.missed.length ? t('week.mapMissed', { list: muscleListText(groups.missed, total) }) : '',
  ].join(' ').trim();

  ui.weekSummary.replaceChildren(
    ...(groups.missed.length || groups.partial.length
      ? [
        ...muscleGroup(t('week.missedHeading'), t('week.missedHint'), groups.missed),
        ...muscleGroup(t('week.partialHeading'), t('week.partialHint'), groups.partial),
      ]
      : [el('p', { className: 'week-done', textContent: t('week.allTrained') })])
  );

  ui.planActions.replaceChildren(
    ...(locked ? [] : [actionButton('button-secondary', t('week.newWeek'), onNewWeek)])
  );
}

// Nadpis + vysvětlivka + klikací chipy svalů. Prázdná skupina se nezobrazí.
function muscleGroup(heading, hint, ids) {
  if (ids.length === 0) return [];
  const sorted = ids.map((id) => ({ id, label: muscleName(id) })).sort(byName);
  return [
    el('h2', { textContent: heading }),
    el('p', { className: 'week-hint', textContent: hint }),
    el('ul', { className: 'chips week-chips' },
      ...sorted.map(({ id, label }) => {
        const button = el('button', { type: 'button', className: 'chip chip-button', textContent: label });
        button.dataset.muscle = id;
        button.setAttribute('aria-label', t('week.showExercises', { name: label }));
        return el('li', {}, button);
      })
    ),
  ];
}

// Seznam cviků, které sval zapojují primárně (ostatní filtry se zruší, ať nic nechybí).
function showMuscleExercises(muscleId) {
  setFilters({ ...EMPTY_FILTERS, muscle: muscleId, role: 'primary' });
  state.scrollY.list = 0; // seznam od začátku
  location.hash = '#/';
}

function onNewWeek() {
  if (!window.confirm(t('week.newWeekConfirm'))) return;
  plan.clearWeek();
  afterPlanChange();
  ui.planFeedback.textContent = t('week.cleared');
  ui.planTitle.focus();
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
// Ve sdíleném náhledu (editable = false) jen pořadí a cvik.
function planItem(ex, index, total, editable = true) {
  const meta = `${t(`type.${ex.type}`)} · ${ex.primary.map(muscleName).join(', ')}`;
  const item = el('li', { className: 'plan-item' },
    numberBadge(index + 1),
    el('a', { className: 'exercise-link', href: `#/cvik/${ex.id}` },
      el('span', { className: 'exercise-name', textContent: localized(ex.name) }),
      el('span', { className: 'exercise-meta', textContent: meta }),
      // Počet dnes odcvičených sérií: kroužek pro oči, skrytý text pro čtečku. Doplní updateDoneCounts().
      ariaHidden(el('span', { className: 'done-count' })),
      el('span', { className: 'done-label visually-hidden' })
    )
  );
  item.dataset.id = ex.id;
  if (editable) {
    item.append(
      el('div', { className: 'plan-move' },
        iconButton('up', ex, index === 0),
        iconButton('down', ex, index === total - 1)
      ),
      iconButton('remove', ex)
    );
  }
  return item;
}

function ariaHidden(node) {
  node.setAttribute('aria-hidden', 'true');
  return node;
}

// Doplní ke cvikům v tréninku počet dnes zapsaných sérií (kroužek s číslem v rohu karty).
// Série se čtou z IndexedDB asynchronně, proto se doplní až po vykreslení seznamu.
async function updateDoneCounts() {
  const counts = new Map(); // id cviku → počet dnešních sérií
  (await log.getSetsForDate(log.localDate())).forEach((s) => {
    counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
  });
  ui.planList.querySelectorAll('.plan-item').forEach((item) => {
    const count = counts.get(item.dataset.id) ?? 0;
    item.querySelector('.done-count').textContent = count ? String(count) : '';
    item.querySelector('.done-label').textContent = count ? t('plan.doneToday', { count }) : '';
  });
}

function onPlanItemAction(button) {
  if (plan.isLocked()) return; // pojistka; v zamčeném tréninku se tlačítka nezobrazují
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

// ===== Sdílení tréninku odkazem =====
// Trénink se celý zapíše do adresy: …/hypertrophica/#/trenink?cviky=id1,id2,…
// Nic se neposílá na server – kdo odkaz otevře, uvidí trénink ve své Hypertrophice.
function planShareUrl(ids) {
  return `${location.origin}${location.pathname}#/trenink?cviky=${ids.join(',')}`;
}

// Z textu „id1,id2,…“ vezme jen existující cviky, každý jednou.
function parseSharedIds(text) {
  return [...new Set(text.split(','))].filter((id) => state.byId.has(id));
}

async function onSharePlan() {
  const ids = plan.getPlan();
  const list = ids.map((id, i) => `${i + 1}. ${localized(state.byId.get(id).name)}`).join('\n');
  try {
    await navigator.share({
      title: t('plan.shareTitle'),
      text: `${t('plan.shareTitle')}\n${list}\n`,
      url: planShareUrl(ids),
    });
  } catch (error) {
    // AbortError = uživatel nabídku sdílení zavřel; jinak zkus aspoň zkopírovat odkaz.
    if (error.name !== 'AbortError') onCopyPlanLink();
  }
}

async function onCopyPlanLink() {
  const url = planShareUrl(plan.getPlan());
  try {
    await navigator.clipboard.writeText(url);
    ui.planFeedback.textContent = t('plan.copied');
  } catch {
    // Schránka není dostupná (starší prohlížeč, zakázané oprávnění) → ukaž odkaz ke zkopírování ručně.
    window.prompt(t('plan.copyManually'), url);
  }
}

function onImportPlan() {
  const ids = state.sharedPlan;
  const current = plan.getPlan();
  const differs = current.join(',') !== ids.join(',');
  if (current.length > 0 && differs
    && !window.confirm(t('plan.replaceConfirm', { count: current.length, number: slotNumber() }))) return;
  plan.setPlan(ids);
  // Adresu přepiš na vlastní trénink (bez přidání do historie, tlačítko Zpět nevede na náhled).
  history.replaceState(null, '', '#/trenink');
  route();
  afterPlanChange();
  ui.planFeedback.textContent = t('plan.imported', { number: slotNumber() });
}

function onClearPlan() {
  if (!window.confirm(t('plan.clearConfirm', { number: slotNumber() }))) return;
  plan.clearPlan();
  afterPlanChange();
  ui.planFeedback.textContent = t('plan.cleared');
  ui.planTitle.focus();
}

// ===== Přepínání pohledů podle adresy =====
// #/ = seznam, #/cvik/<id> = detail cviku, #/trenink = trénink,
// #/trenink?cviky=id1,id2,… = sdílený trénink (náhled s možností uložit),
// #/tyden = souhrn tréninků 1–4 (stejný pohled jako trénink, jiná záložka),
// #/historie = historie zapsaných sérií,
// #/nastaveni = nastavení (motiv, záloha a obnova dat),
// #/telo = hmotnost a tělesné míry
function route() {
  const previous = state.view;
  // Zapamatuj si, kam se v seznamu / tréninku / historii odscrollovalo, ať se tam dá vrátit.
  if (previous in state.scrollY) state.scrollY[previous] = window.scrollY;

  const detail = location.hash.match(/^#\/cvik\/([\w-]+)$/);
  if (detail) {
    // „Zpět“ z detailu vede tam, odkud byl detail otevřen.
    if (previous !== 'detail') {
      state.returnHash = { plan: state.planHash, history: '#/historie' }[previous] ?? '#/';
    }
    showDetail(detail[1]);
    return;
  }

  const planMatch = location.hash.match(/^#\/trenink(?:\?(.*))?$/);
  if (planMatch) {
    state.planHash = location.hash;
    const shared = new URLSearchParams(planMatch[1] ?? '').get('cviky');
    state.sharedPlan = shared === null ? null : parseSharedIds(shared);
    state.showWeek = false;
    showPlan(previous);
  } else if (location.hash === '#/historie') {
    showHistory(previous);
  } else if (location.hash === '#/nastaveni') {
    showSettings();
  } else if (location.hash === '#/telo') {
    showBody();
  } else if (location.hash === '#/tyden') {
    state.planHash = location.hash;
    state.sharedPlan = null;
    state.showWeek = true;
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
  ui.historyView.hidden = name !== 'history';
  ui.settingsView.hidden = name !== 'settings';
  ui.bodyView.hidden = name !== 'body';
  // Zvýrazní ikonu tréninku / historie / nastavení / těla v hlavičce, když je pohled otevřený.
  [[ui.planLink, 'plan'], [ui.historyLink, 'history'], [ui.settingsLink, 'settings'], [ui.bodyLink, 'body']].forEach(([link, view]) => {
    if (name === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
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

// Detail cviku na PC: klik do prázdného místa vlevo nebo vpravo od obsahu = „Zpět“
// (stejně jako odkaz „← Zpět na …“). Jen od 900 px – na mobilu jsou okraje úzké
// a omylem klepnutý okraj by uprostřed cvičení zavřel rozepsaný záznam série.
const wideLayout = window.matchMedia('(min-width: 900px)');

function onDetailBackgroundClick(event) {
  if (state.view !== 'detail' || !wideLayout.matches) return;
  const target = event.target;
  // Jen pozadí stránky – ne hlavička, ovládací prvky ani schéma svalů vlevo.
  const onBackground = target === document.documentElement || target === document.body || target.closest('main');
  if (!onBackground || target.closest('a, button, input, select, label, figure')) return;
  // Konec označování textu myší taky vyvolá „klik“ – ten se nepočítá.
  if (!window.getSelection().isCollapsed) return;
  // Klik do sloupce s obsahem (i do mezery mezi sekcemi) nic nedělá, počítají se jen strany.
  // Odkaz zpět je na PC roztažený přes celou šířku sloupce, proto podle něj.
  const column = ui.detailView.querySelector('.back-link').getBoundingClientRect();
  if (event.clientX >= column.left && event.clientX <= column.right) return;
  location.hash = state.returnHash;
}

// Detail cviku: klávesa Esc = „Zpět“. Neplatí, když se právě píše do políčka formuláře
// (Esc tam jen opustí políčko), aby se omylem nezavřela rozepsaná série.
function onDetailEscape(event) {
  if (state.view !== 'detail' || event.key !== 'Escape' || event.defaultPrevented) return;
  if (event.target.closest('input, select, textarea')) {
    event.target.blur();
    return;
  }
  location.hash = state.returnHash;
}

function backLink() {
  const key = state.returnHash === '#/' ? 'detail.back'
    : state.returnHash === '#/historie' ? 'detail.backToHistory'
      : 'detail.backToPlan';
  const text = t(key);
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
  nodes.push(logSection(ex));
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

// ===== Záznam sérií (v detailu cviku) =====
// Formulář hmotnost / opakování / RIR, pod ním dnešní série a souhrn posledních tréninků.
// Série ukládá js/log.js do IndexedDB; čtení je asynchronní, proto se seznamy
// doplní až po načtení (renderLog).

// Kolik předchozích tréninků cviku ukázat v detailu (všechny jsou v Historii).
const LOG_HISTORY_DAYS = 5;

// Čísla podle jazyka: česky 82,5 (desetinná čárka), anglicky 82.5.
// Formát se vytvoří až při prvním použití – jazyk je známý až po startu aplikace.
let numberFormat;
function formatNumber(value) {
  numberFormat ??= new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 2, useGrouping: false });
  return numberFormat.format(value);
}

// "80 kg × 8" nebo "80 kg × 8 · RIR 2"
function formatSet(set) {
  const params = { weight: formatNumber(set.weightKg), reps: set.reps, rir: set.rir };
  return t(set.rir === null ? 'log.set' : 'log.setRir', params);
}

// Souhrn sérií jednoho dne: po sobě jdoucí série se stejnou hmotností se sloučí.
// [80×8, 80×8, 80×7, 85×6] → "80 kg × 8, 8, 7 | 85 kg × 6"
function summarizeSets(sets) {
  const groups = [];
  sets.forEach((set) => {
    const last = groups[groups.length - 1];
    if (last && last.weightKg === set.weightKg) last.reps.push(set.reps);
    else groups.push({ weightKg: set.weightKg, reps: [set.reps] });
  });
  return groups.map((g) => `${formatNumber(g.weightKg)} kg × ${g.reps.join(', ')}`).join(' | ');
}

// "2026-10-13" → "13. 10. 2026" (s dlouhým: "pondělí 13. 10. 2026"), anglicky "13/10/2026"
function formatDate(isoDate, withWeekday = false) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(currentLocale(), {
    ...(withWeekday ? { weekday: 'long' } : {}),
    day: 'numeric', month: 'numeric', year: 'numeric',
  });
}

// Text z políčka → číslo. Přijme desetinnou čárku i tečku. Prázdné políčko = null, nesmysl = NaN.
function parseNumber(text) {
  const value = text.trim().replace(',', '.');
  if (value === '') return null;
  return /^\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
}

// Políčko s tlačítky − a + (na mobilu se hodnota mění klepnutím, bez psaní).
// step = o kolik tlačítka mění hodnotu; start = hodnota po klepnutí na + u prázdného políčka
// (číslo, nebo funkce, která ho vrátí – např. poslední zapsaná hodnota).
function stepperField({ id, label, hint, inputMode, step, start, min, max }) {
  const input = el('input', { id, type: 'text', inputMode, autocomplete: 'off', className: 'log-input' });
  const change = (direction) => {
    const value = parseNumber(input.value);
    if (value === null || Number.isNaN(value)) {
      if (direction > 0) input.value = formatNumber(typeof start === 'function' ? start() : start);
      return;
    }
    // Zaokrouhlení: 82.1 + 0.1 by v počítači dalo 82.19999…
    const next = Math.round((value + direction * step) * 100) / 100;
    input.value = formatNumber(Math.min(max, Math.max(min, next)));
    input.removeAttribute('aria-invalid');
  };
  const stepButton = (direction, symbol, key) => {
    const button = el('button', { type: 'button', className: 'log-step', textContent: symbol });
    button.setAttribute('aria-label', t(key, { name: label }));
    button.addEventListener('click', () => change(direction));
    return button;
  };
  if (hint) input.setAttribute('aria-describedby', `${id}-hint`);
  const field = el('div', { className: 'log-field' },
    el('label', { htmlFor: id, textContent: label }),
    el('div', { className: 'log-stepper' }, stepButton(-1, '−', 'log.decrease'), input, stepButton(1, '+', 'log.increase')),
    hint ? el('p', { id: `${id}-hint`, className: 'log-hint', textContent: hint }) : null
  );
  return { field, input };
}

// Pořadové číslo posledního vykreslení – pomalejší starší načtení pak nepřepíše novější.
let logRenderId = 0;

function logSection(ex) {
  const weight = stepperField({
    id: 'log-weight', label: t('log.weight'), inputMode: 'decimal',
    step: 2.5, start: 20, ...log.LIMITS.weightKg,
  });
  const reps = stepperField({
    id: 'log-reps', label: t('log.reps'), inputMode: 'numeric',
    step: 1, start: 8, ...log.LIMITS.reps,
  });
  const rir = stepperField({
    id: 'log-rir', label: t('log.rir'), hint: t('log.rirHint'), inputMode: 'numeric',
    step: 1, start: 2, ...log.LIMITS.rir,
  });
  const feedback = el('p', { className: 'log-feedback' });
  feedback.setAttribute('role', 'status');
  const lists = el('div', { className: 'log-lists' });
  const form = el('form', { className: 'log-form', noValidate: true },
    el('div', { className: 'log-fields' }, weight.field, reps.field, rir.field),
    el('button', { type: 'submit', className: 'button-primary log-submit', textContent: t('log.add') })
  );
  const section = el('section', { className: 'log' },
    el('h2', { id: 'log-heading', textContent: t('log.heading') }),
    form,
    feedback,
    lists
  );
  section.setAttribute('aria-labelledby', 'log-heading');
  const inputs = { weight: weight.input, reps: reps.input, rir: rir.input };

  form.addEventListener('submit', async (event) => {
    event.preventDefault(); // jinak by prohlížeč stránku znovu načetl
    const values = readLogForm(inputs, feedback);
    if (!values) return;
    let saved;
    try {
      saved = await log.addSet({ exerciseId: ex.id, ...values });
    } catch (error) {
      console.error(error);
      feedback.textContent = t('log.errorSave');
      return;
    }
    // Hodnoty ve formuláři zůstanou – další série bývá stejná, stačí znovu klepnout.
    const today = await renderLog(lists, ex.id, inputs);
    feedback.textContent = t('log.saved', { number: today.length, set: formatSet(saved) });
  });

  lists.addEventListener('click', async (event) => {
    const button = event.target.closest('.log-delete');
    if (!button) return;
    const { id, number, label } = button.dataset;
    if (!window.confirm(t('log.deleteConfirm', { number, set: label }))) return;
    await log.deleteSet(id);
    await renderLog(lists, ex.id, inputs);
    feedback.textContent = t('log.deleted');
    form.querySelector('.log-submit').focus(); // smazané tlačítko zmizelo, fokus nesmí zůstat „nikde“
  });

  renderLog(lists, ex.id, inputs, true);
  return section;
}

// Zkontroluje formulář. Vrátí { weightKg, reps, rir }, nebo null a ukáže chybu u políčka.
function readLogForm(inputs, feedback) {
  Object.values(inputs).forEach((input) => input.removeAttribute('aria-invalid'));
  const fail = (input, key) => {
    input.setAttribute('aria-invalid', 'true');
    feedback.textContent = t(key);
    input.focus();
    return null;
  };
  const weightKg = log.cleanWeight(parseNumber(inputs.weight.value));
  if (weightKg === null) return fail(inputs.weight, 'log.errorWeight');
  const reps = parseNumber(inputs.reps.value);
  if (!log.isValidReps(reps)) return fail(inputs.reps, 'log.errorReps');
  const rir = parseNumber(inputs.rir.value);
  if (!log.isValidRir(rir)) return fail(inputs.rir, 'log.errorRir');
  return { weightKg, reps, rir };
}

// Načte série cviku a vykreslí dnešní série + souhrn předchozích tréninků.
// prefill = při otevření detailu předvyplnit formulář hodnotami poslední série.
// Vrátí dnešní série.
async function renderLog(container, exerciseId, inputs, prefill = false) {
  const renderId = ++logRenderId;
  const [sets, persistent] = await Promise.all([log.getSetsForExercise(exerciseId), log.isStorageAvailable()]);
  const today = log.localDate();
  const todaySets = sets.filter((s) => s.date === today);
  if (renderId !== logRenderId) return todaySets;

  const last = sets[sets.length - 1];
  if (prefill && last && Object.values(inputs).every((input) => input.value === '')) {
    inputs.weight.value = formatNumber(last.weightKg);
    inputs.reps.value = String(last.reps);
    inputs.rir.value = last.rir === null ? '' : String(last.rir);
  }

  // Předchozí dny: seskupit podle data, nejnovější nahoře.
  const byDate = new Map();
  sets.filter((s) => s.date < today).forEach((s) => {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  });
  const previous = [...byDate].reverse().slice(0, LOG_HISTORY_DAYS);

  container.replaceChildren(
    ...(persistent ? [] : [el('p', { className: 'log-warning', textContent: t('log.memoryOnly') })]),
    el('h3', { textContent: t('log.today') }),
    todaySets.length
      ? listWithRole('ol', 'log-today', todaySets.map(logTodayItem))
      : el('p', { className: 'log-empty', textContent: t('log.todayEmpty') }),
    ...(previous.length ? [
      el('h3', { textContent: t('log.previous') }),
      listWithRole('ul', 'log-history', previous.map(([date, daySets]) => el('li', {},
        el('span', { className: 'log-date', textContent: formatDate(date) }),
        el('span', { textContent: summarizeSets(daySets) })
      ))),
    ] : []),
    el('a', { className: 'log-all', href: '#/historie', textContent: t('log.allHistory') })
  );
  return todaySets;
}

// Seznam bez odrážek s role="list" (Safari jinak nehlásí čtečce obrazovky, že jde o seznam).
function listWithRole(tag, className, items) {
  const list = el(tag, { className }, ...items);
  list.setAttribute('role', 'list');
  return list;
}

// Jedna dnešní série: číslo | 80 kg × 8 · RIR 2 | ×
function logTodayItem(set, index) {
  const label = formatSet(set);
  const button = el('button', { type: 'button', className: 'icon-button log-delete' });
  Object.assign(button.dataset, { id: set.id, number: String(index + 1), label });
  button.setAttribute('aria-label', t('log.deleteSet', { number: index + 1, set: label }));
  button.title = button.getAttribute('aria-label');
  button.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">'
    + ICONS.remove + '</svg>';
  return el('li', { className: 'log-set' },
    numberBadge(index + 1),
    el('span', { className: 'log-set-text', textContent: label }),
    button
  );
}

// ===== Pohled Nastavení =====
// Motiv (obsluhuje js/theme.js) a záloha dat. Při každém otevření začíná „načisto“:
// bez staré hlášky a bez rozpracovaného náhledu importu.
function showSettings() {
  setView('settings');
  ui.backupFeedback.textContent = '';
  closeImportPreview();
  window.scrollTo(0, 0);
  ui.settingsTitle.focus();
}

// ===== Pohled Historie =====
// Všechny zapsané série seskupené po dnech (nejnovější nahoře), v rámci dne po cvicích.
// Zobrazuje se po HISTORY_PAGE dnech, starší přidá tlačítko „Zobrazit starší“.
const HISTORY_PAGE = 20;
let historyRenderId = 0;

async function showHistory(previous) {
  setView('history');
  state.historyDays = Math.max(state.historyDays, HISTORY_PAGE);
  await renderHistory();
  if (previous === 'detail') {
    restorePosition('history', ui.historyList);
  } else {
    window.scrollTo(0, 0);
    ui.historyTitle.focus();
  }
}

async function renderHistory() {
  const renderId = ++historyRenderId;
  const sets = await log.getAllSets();
  if (renderId !== historyRenderId) return;

  // datum → (id cviku → série); Map zachová pořadí, v jakém byly cviky ten den poprvé zapsány.
  const days = new Map();
  sets.forEach((s) => {
    if (!days.has(s.date)) days.set(s.date, new Map());
    const exercises = days.get(s.date);
    if (!exercises.has(s.exerciseId)) exercises.set(s.exerciseId, []);
    exercises.get(s.exerciseId).push(s);
  });
  const dates = [...days.keys()].reverse();

  ui.historyIntro.textContent = sets.length
    ? t('history.summary', { sets: sets.length, days: dates.length })
    : t('history.empty');
  ui.historyList.replaceChildren(...dates.slice(0, state.historyDays).map((date) =>
    // id = cíl skoku z kalendáře; tabindex -1 = nadpis jde zaměřit skriptem (pro čtečky obrazovky)
    el('section', { className: 'history-day', id: `den-${date}` },
      el('h2', { textContent: formatDate(date, true), tabIndex: -1 }),
      listWithRole('ul', 'history-exercises', [...days.get(date)].map(([exerciseId, daySets]) =>
        el('li', {},
          el('a', {
            className: 'history-exercise',
            href: `#/cvik/${exerciseId}`,
            // Cvik, který už v datech není, se ukáže aspoň pod svým ID.
            textContent: localized(state.byId.get(exerciseId)?.name) || exerciseId,
          }),
          el('span', { className: 'history-sets', textContent: summarizeSets(daySets) })
        )
      ))
    )
  ));
  ui.historyMore.hidden = dates.length <= state.historyDays;

  state.historyDates = dates;
  state.historySetCounts = new Map([...days].map(([date, exercises]) =>
    [date, [...exercises.values()].reduce((sum, daySets) => sum + daySets.length, 0)]));
  renderCalendar();
}

// ===== Kalendář v Historii =====
// Měsíční mřížka (týden začíná pondělím). Dny s tréninkem jsou zvýrazněné tlačítko,
// klik přeskočí na daný den v seznamu vpravo (na mobilu pod kalendářem).

// Záhlaví sloupců: zkratky dnů „po út st čt pá so ne“ podle češtiny prohlížeče.
function renderCalendarWeekdays() {
  ui.calendarWeekdays.replaceChildren(...[...Array(7)].map((_, i) => {
    const day = new Date(2024, 0, 1 + i); // 1. 1. 2024 bylo pondělí
    return el('th', {
      scope: 'col',
      abbr: day.toLocaleDateString(currentLocale(), { weekday: 'long' }),
      textContent: day.toLocaleDateString(currentLocale(), { weekday: 'short' }),
    });
  }));
}

function renderCalendar() {
  const now = new Date();
  // Výchozí měsíc = aktuální; zůstane zvolený, dokud se stránka znovu nenačte.
  state.calendarMonth ??= { year: now.getFullYear(), month: now.getMonth() };
  const { year, month } = state.calendarMonth;
  const today = log.localDate();

  const monthLabel = new Date(year, month, 1).toLocaleDateString(currentLocale(), { month: 'long', year: 'numeric' });
  ui.calendarMonth.textContent = monthLabel;

  // Dopředu nejdál na aktuální měsíc, dozadu nejdál na měsíc prvního tréninku.
  const key = year * 12 + month;
  const oldest = state.historyDates.at(-1);
  const [oldestYear, oldestMonth] = oldest ? oldest.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  ui.calendarNext.disabled = key >= now.getFullYear() * 12 + now.getMonth();
  ui.calendarPrev.disabled = key <= oldestYear * 12 + oldestMonth - 1;

  // Kolik prázdných políček před 1. dnem: getDay() vrací 0 = neděle, převod na 0 = pondělí.
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(el('td'));
  for (let day = 1; day <= daysInMonth; day++) {
    const date = log.localDate(new Date(year, month, day));
    const count = state.historySetCounts.get(date) ?? 0;
    const content = count
      ? el('button', {
        type: 'button',
        className: 'calendar-day has-training',
        textContent: day,
        onclick: () => jumpToHistoryDay(date),
      })
      : el('span', { className: 'calendar-day', textContent: day });
    if (count) content.setAttribute('aria-label', t('calendar.dayLabel', { date: formatDate(date, true), sets: count }));
    if (date === today) {
      content.classList.add('is-today');
      content.setAttribute('aria-current', 'date');
    }
    cells.push(el('td', {}, content));
  }
  // Vždy 6 řádků, aby kalendář neměnil výšku při přepínání měsíců.
  while (cells.length < 42) cells.push(el('td'));

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(el('tr', {}, ...cells.slice(i, i + 7)));
  ui.calendarDays.replaceChildren(...rows);
}

function shiftCalendarMonth(delta) {
  const { year, month } = state.calendarMonth;
  const next = new Date(year, month + delta, 1);
  state.calendarMonth = { year: next.getFullYear(), month: next.getMonth() };
  renderCalendar();
}

// Skok na den v seznamu. Když je den mezi staršími, které ještě nejsou zobrazené,
// seznam se nejdřív rozšíří (jako opakované „Zobrazit starší“).
async function jumpToHistoryDay(date) {
  const index = state.historyDates.indexOf(date);
  if (index < 0) return;
  if (index >= state.historyDays) {
    state.historyDays = Math.ceil((index + 1) / HISTORY_PAGE) * HISTORY_PAGE;
    await renderHistory();
  }
  const heading = document.querySelector(`#den-${date} h2`);
  if (!heading) return;
  heading.scrollIntoView({ block: 'start', behavior: 'smooth' });
  heading.focus({ preventScroll: true });
}

// ===== Pohled Tělo =====
// Zápis hmotnosti a tělesných měr (jeden záznam na den, js/body.js), přehled posledních
// hodnot, graf vývoje vybrané míry a seznam všech měření s úpravou a smazáním.
const BODY_PAGE = 20;
const BODY_METRIC = new Map(body.METRICS.map((m) => [m.key, m]));
// Míry v části formuláře „Míry (cm)“ (pod hmotností a tukem).
const BODY_CM_KEYS = body.METRICS.filter((m) => m.unit === 'cm').map((m) => m.key);
let bodyRenderId = 0;
const bodyForm = {
  date: null, // <input type="date">
  dateHint: null, // poznámka pod datem („pro tento den už je měření uložené“)
  inputs: new Map(), // klíč míry → <input>
  prefilled: false, // true = políčka obsahují uložený záznam (ne rozepsané hodnoty)
};

// "82,4 kg", "84,5 cm", česky "15 %", anglicky "15%"
function formatMetric(key, value) {
  const { unit } = BODY_METRIC.get(key);
  return unit === '%' ? t('body.percent', { value: formatNumber(value) }) : `${formatNumber(value)} ${unit}`;
}

// "2026-10-19" → "19. 10." (anglicky "19/10"); s rokem, když není letošní.
function formatShortDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const options = { day: 'numeric', month: 'numeric', ...(y !== new Date().getFullYear() ? { year: 'numeric' } : {}) };
  return new Date(y, m - 1, d).toLocaleDateString(currentLocale(), options);
}

// Poslední zapsaná hodnota míry (pro tlačítko + u prázdného políčka), nebo undefined.
function lastBodyValue(key) {
  return state.bodyRecords.findLast((r) => r[key] !== null)?.[key];
}

// Formulář se vytvoří jednou při startu, při otevření pohledu se jen předvyplní.
function createBodyForm() {
  bodyForm.date = el('input', { id: 'body-date', type: 'date', className: 'log-input measures-date' });
  bodyForm.dateHint = el('p', { id: 'body-date-hint', className: 'log-hint' });
  bodyForm.date.setAttribute('aria-describedby', 'body-date-hint');
  bodyForm.date.addEventListener('change', fillBodyForm);
  const fields = new Map(body.METRICS.map((m) => {
    const { field, input } = stepperField({
      id: `body-${m.key}`, label: t(`body.field.${m.key}`), inputMode: 'decimal',
      step: m.step, start: () => lastBodyValue(m.key) ?? m.start, min: m.min, max: m.max,
    });
    bodyForm.inputs.set(m.key, input);
    return [m.key, field];
  }));
  ui.bodyForm.replaceChildren(
    el('div', { className: 'log-field measures-date-field' },
      el('label', { htmlFor: 'body-date', textContent: t('body.date') }),
      bodyForm.date,
      bodyForm.dateHint
    ),
    el('div', { className: 'log-fields measures-fields' }, fields.get('weightKg'), fields.get('bodyFat')),
    // Míry v cm jsou vidět hned, bez rozbalování.
    el('div', { className: 'measures-cm' },
      el('h3', { textContent: t('body.moreMeasures') }),
      el('div', { className: 'log-fields measures-fields' }, ...BODY_CM_KEYS.map((key) => fields.get(key)))
    ),
    el('button', { type: 'submit', className: 'button-primary log-submit', textContent: t('body.save') })
  );
}

// Předvyplní formulář uloženým měřením zvoleného dne. Když pro den nic uložené není,
// políčka se vyprázdní – ale jen pokud v nich byl uložený záznam jiného dne;
// rozepsané hodnoty zůstanou (uživatel třeba jen opravuje datum).
function fillBodyForm() {
  const record = state.bodyRecords.find((r) => r.date === bodyForm.date.value);
  bodyForm.inputs.forEach((input, key) => {
    input.removeAttribute('aria-invalid');
    if (record) input.value = record[key] === null ? '' : formatNumber(record[key]);
    else if (bodyForm.prefilled) input.value = '';
  });
  bodyForm.prefilled = Boolean(record);
  bodyForm.date.removeAttribute('aria-invalid');
  bodyForm.dateHint.textContent = record ? t('body.existingHint') : '';
}

async function showBody() {
  setView('body');
  state.bodyItems = Math.max(state.bodyItems, BODY_PAGE);
  ui.bodyFeedback.textContent = '';
  window.scrollTo(0, 0);
  ui.bodyTitle.focus();
  await renderBody();
  // Výchozí den formuláře = dnes (datum v políčku zůstane, dokud se stránka znovu nenačte).
  const today = log.localDate();
  bodyForm.date.max = today;
  if (!bodyForm.date.value) bodyForm.date.value = today;
  fillBodyForm();
}

// Načte měření a překreslí přehled, graf a seznam.
async function renderBody() {
  const renderId = ++bodyRenderId;
  const [records, persistent] = await Promise.all([body.getAll(), log.isStorageAvailable()]);
  if (renderId !== bodyRenderId) return;
  state.bodyRecords = records;
  // Míra v grafu musí mít data; jinak první míra, která je zapsaná.
  if (!records.some((r) => r[state.bodyMetric] !== null)) {
    state.bodyMetric = body.METRIC_KEYS.find((key) => records.some((r) => r[key] !== null)) ?? 'weightKg';
  }
  ui.bodyIntro.replaceChildren(
    el('p', { textContent: records.length ? t('body.summary', { count: records.length }) : t('body.empty') }),
    ...(persistent ? [] : [el('p', { className: 'log-warning', textContent: t('body.memoryOnly') })])
  );
  renderBodyLatest();
  renderBodyChart();
  renderBodyList();
}

// Dlaždice s poslední hodnotou každé zapsané míry a změnou oproti předchozímu měření.
function renderBodyLatest() {
  const tiles = body.METRIC_KEYS.flatMap((key) => {
    const values = state.bodyRecords.filter((r) => r[key] !== null);
    if (!values.length) return [];
    const last = values[values.length - 1];
    const previous = values[values.length - 2];
    let change;
    if (previous) {
      const delta = Math.round((last[key] - previous[key]) * 10) / 10;
      const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
      change = t('body.delta', { delta: sign + formatNumber(Math.abs(delta)), date: formatShortDate(previous.date) });
    } else {
      change = t('body.measuredOn', { date: formatShortDate(last.date) });
    }
    const button = el('button', { type: 'button', className: 'measure-tile' },
      el('span', { className: 'measure-tile-label', textContent: t(`body.metric.${key}`) }),
      el('span', { className: 'measure-tile-value', textContent: formatMetric(key, last[key]) }),
      el('span', { className: 'measure-tile-change', textContent: change })
    );
    button.dataset.metric = key;
    button.setAttribute('aria-pressed', String(key === state.bodyMetric));
    button.title = t('body.showInChart');
    return [el('li', {}, button)];
  });
  ui.bodyLatest.replaceChildren(...tiles);
  ui.bodyLatestSection.hidden = tiles.length === 0;
}

function onBodyTileClick(event) {
  const tile = event.target.closest('.measure-tile');
  if (!tile) return;
  state.bodyMetric = tile.dataset.metric;
  ui.bodyLatest.querySelectorAll('.measure-tile').forEach((b) => {
    b.setAttribute('aria-pressed', String(b === tile));
  });
  renderBodyChart();
}

// Seznam měření od nejnovějšího: datum, hodnoty, tlačítka Upravit a Smazat.
function renderBodyList() {
  const records = [...state.bodyRecords].reverse();
  ui.bodyList.replaceChildren(...records.slice(0, state.bodyItems).map((record) => {
    const values = body.METRIC_KEYS.filter((key) => record[key] !== null)
      .map((key) => `${t(`body.metric.${key}`)} ${formatMetric(key, record[key])}`)
      .join(' · ');
    const date = formatDate(record.date, true);
    const button = (action, icon, key) => {
      const b = el('button', { type: 'button', className: `icon-button measures-${action}` });
      b.dataset.date = record.date;
      b.setAttribute('aria-label', t(key, { date }));
      b.title = b.getAttribute('aria-label');
      b.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">${icon}</svg>`;
      return b;
    };
    return el('li', { className: 'measures-item' },
      el('div', { className: 'measures-item-text' },
        el('span', { className: 'measures-item-date', textContent: date }),
        el('span', { className: 'measures-item-values', textContent: values })
      ),
      button('edit', '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>', 'body.edit'),
      button('delete', ICONS.remove, 'body.delete')
    );
  }));
  ui.bodyListSection.hidden = records.length === 0;
  ui.bodyMore.hidden = records.length <= state.bodyItems;
}

async function onBodyListClick(event) {
  const button = event.target.closest('.icon-button');
  if (!button) return;
  const { date } = button.dataset;
  if (button.classList.contains('measures-edit')) {
    // Úprava = načtení dne do formuláře nahoře; uložení záznam přepíše.
    bodyForm.date.value = date;
    fillBodyForm();
    ui.bodyFeedback.textContent = t('body.editing', { date: formatDate(date) });
    ui.bodyForm.scrollIntoView({ block: 'center', behavior: 'smooth' });
    bodyForm.inputs.get('weightKg').focus({ preventScroll: true });
    return;
  }
  if (!window.confirm(t('body.deleteConfirm', { date: formatDate(date) }))) return;
  try {
    await body.remove(date);
  } catch (error) {
    console.error(error);
    ui.bodyFeedback.textContent = t('body.errorSave');
    return;
  }
  await renderBody();
  if (bodyForm.date.value === date) fillBodyForm();
  ui.bodyFeedback.textContent = t('body.deleted', { date: formatDate(date) });
  ui.bodyForm.querySelector('.log-submit').focus(); // smazané tlačítko zmizelo, fokus nesmí zůstat „nikde“
}

// Zkontroluje formulář. Vrátí { date, values }, nebo null a ukáže chybu u políčka.
function readBodyForm() {
  const fail = (input, message) => {
    input.setAttribute('aria-invalid', 'true');
    ui.bodyFeedback.textContent = message;
    input.focus();
    return null;
  };
  bodyForm.date.removeAttribute('aria-invalid');
  bodyForm.inputs.forEach((input) => input.removeAttribute('aria-invalid'));
  const date = bodyForm.date.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > log.localDate()) return fail(bodyForm.date, t('body.errorDate'));
  const values = {};
  for (const [key, input] of bodyForm.inputs) {
    const number = parseNumber(input.value);
    if (number === null) {
      values[key] = null;
      continue;
    }
    const value = body.cleanValue(key, number);
    if (value === undefined) {
      const { min, max } = BODY_METRIC.get(key);
      return fail(input, t('body.errorRange', {
        name: t(`body.metric.${key}`), min: formatMetric(key, min), max: formatMetric(key, max),
      }));
    }
    values[key] = value;
  }
  if (Object.values(values).every((v) => v === null)) {
    return fail(bodyForm.inputs.get('weightKg'), t('body.errorEmpty'));
  }
  return { date, values };
}

async function onBodySubmit(event) {
  event.preventDefault(); // jinak by prohlížeč stránku znovu načetl
  const entry = readBodyForm();
  if (!entry) return;
  try {
    await body.save(entry.date, entry.values);
  } catch (error) {
    console.error(error);
    ui.bodyFeedback.textContent = t('body.errorSave');
    return;
  }
  await renderBody();
  fillBodyForm(); // přepíše políčka uloženými (zaokrouhlenými) hodnotami a ukáže poznámku u data
  ui.bodyFeedback.textContent = t('body.saved', { date: formatDate(entry.date) });
}

// ===== Graf vývoje míry (pohled Tělo) =====
// Čárový graf jedné míry v čase, kreslený jako SVG přímo v kódu (bez knihovny, funguje offline).
// Osa x = skutečný čas (mezery mezi měřeními odpovídají počtu dní), osa y = hodnota.
// Kreslí se v pixelech podle šířky prvku, aby text v grafu měl na mobilu i PC stejnou velikost.
const BODY_RANGES = { '3m': 3, '1y': 12, all: null }; // období grafu → počet měsíců (null = vše)
const SVG_NS = 'http://www.w3.org/2000/svg';
// Nad tento počet bodů se kreslí jen čára (kolečka by splynula), zvýrazněný zůstane poslední bod.
const CHART_MAX_MARKERS = 60;

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
  return node;
}

// Přepínač období grafu (3 měsíce / rok / vše); vytvoří se jednou při startu.
function createBodyRange() {
  ui.bodyRange.replaceChildren(...Object.keys(BODY_RANGES).map((range) => {
    const button = el('button', {
      type: 'button', className: 'button-secondary button-toggle', textContent: t(`body.range.${range}`),
    });
    button.dataset.range = range;
    button.setAttribute('aria-pressed', String(range === state.bodyRange));
    button.addEventListener('click', () => {
      state.bodyRange = range;
      ui.bodyRange.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      renderBodyChart();
    });
    return button;
  }));
}

// "Hezké" hodnoty pro vodorovné čáry mřížky: 80, 82, 84… místo 80,37, 82,11…
function niceTicks(min, max, count = 4) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= raw);
  const ticks = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6); // bez chyb zaokrouhlení typu 82.00000001
  }
  return ticks;
}

// "2026-10-19" → časové razítko v ms (poledne místního času, aby nevadil přechod na letní čas)
const dateToTime = (isoDate) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};

function renderBodyChart() {
  const key = state.bodyMetric;
  const all = state.bodyRecords.filter((r) => r[key] !== null);
  ui.bodyChart.hidden = all.length === 0;
  if (!all.length) return;
  ui.bodyChartTitle.textContent = t(`body.field.${key}`) + (BODY_METRIC.get(key).unit === 'cm' ? ' (cm)' : '');

  const months = BODY_RANGES[state.bodyRange];
  const now = new Date();
  const from = months ? log.localDate(new Date(now.getFullYear(), now.getMonth() - months, now.getDate())) : '';
  const points = all.filter((r) => r.date >= from).map((r) => ({ date: r.date, value: r[key], time: dateToTime(r.date) }));
  if (points.length < 2) {
    ui.bodyChartFigure.replaceChildren();
    ui.bodyChartNote.textContent = t('body.chartTooFew');
    return;
  }
  ui.bodyChartNote.textContent = '';

  // Rozměry v pixelech; okraje = místo pro popisky os.
  const width = Math.max(ui.bodyChartFigure.clientWidth, 280);
  const height = Math.round(Math.min(Math.max(width * 0.6, 200), 360));
  const pad = { top: 12, right: 14, bottom: 28, left: 48 };
  const values = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const [low, high] = [ticks[0], ticks[ticks.length - 1]];
  const [start, end] = [points[0].time, points[points.length - 1].time];
  const x = (time) => pad.left + ((time - start) / (end - start)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + ((high - value) / (high - low)) * (height - pad.top - pad.bottom);

  const first = points[0];
  const last = points[points.length - 1];
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'measures-svg', role: 'img' });
  // Popis pro čtečky obrazovky; jednotlivé hodnoty jsou v seznamu měření.
  svg.setAttribute('aria-label', t('body.chartLabel', {
    metric: t(`body.metric.${key}`), count: points.length,
    from: formatDate(first.date), first: formatMetric(key, first.value),
    to: formatDate(last.date), last: formatMetric(key, last.value),
  }));

  // Mřížka a popisky osy y
  ticks.forEach((tick) => {
    svg.append(
      svgEl('line', { class: 'chart-grid', x1: pad.left, x2: width - pad.right, y1: y(tick), y2: y(tick) }),
      Object.assign(svgEl('text', { class: 'chart-label', x: pad.left - 8, y: y(tick), 'text-anchor': 'end', 'dominant-baseline': 'middle' }),
        { textContent: formatNumber(tick) })
    );
  });
  // Popisky osy x: první a poslední den (a prostřední, když je místo)
  const xLabels = [[first, 'start'], [last, 'end']];
  if (width >= 480) xLabels.push([{ time: (start + end) / 2, date: log.localDate(new Date((start + end) / 2)) }, 'middle']);
  xLabels.forEach(([point, anchor]) => {
    svg.append(Object.assign(svgEl('text', { class: 'chart-label', x: x(point.time), y: height - 8, 'text-anchor': anchor }),
      { textContent: formatShortDate(point.date) }));
  });

  // Čára a body
  svg.append(svgEl('polyline', {
    class: 'chart-line', points: points.map((p) => `${x(p.time)},${y(p.value)}`).join(' '),
  }));
  const markers = points.length <= CHART_MAX_MARKERS ? points : [last];
  markers.forEach((p) => svg.append(svgEl('circle', { class: 'chart-point', cx: x(p.time), cy: y(p.value), r: 4 })));

  // Najetí myší / dotyk: svislá čára a bublina s hodnotou nejbližšího měření.
  const guide = svgEl('line', { class: 'chart-guide', y1: pad.top, y2: height - pad.bottom, visibility: 'hidden' });
  const focus = svgEl('circle', { class: 'chart-point chart-focus', r: 6, visibility: 'hidden' });
  const hit = svgEl('rect', { class: 'chart-hit', x: pad.left, y: 0, width: width - pad.left - pad.right, height });
  svg.append(guide, focus, hit);
  const tooltip = el('div', { className: 'measures-tooltip', hidden: true });
  tooltip.setAttribute('aria-hidden', 'true'); // čtečky mají popis grafu a seznam měření
  const show = (event) => {
    const box = svg.getBoundingClientRect();
    const pointerX = event.clientX - box.left;
    const nearest = points.reduce((best, p) => (Math.abs(x(p.time) - pointerX) < Math.abs(x(best.time) - pointerX) ? p : best));
    const [px, py] = [x(nearest.time), y(nearest.value)];
    guide.setAttribute('x1', px);
    guide.setAttribute('x2', px);
    focus.setAttribute('cx', px);
    focus.setAttribute('cy', py);
    guide.setAttribute('visibility', 'visible');
    focus.setAttribute('visibility', 'visible');
    tooltip.textContent = `${formatShortDate(nearest.date)} · ${formatMetric(key, nearest.value)}`;
    tooltip.hidden = false;
    // Bublina nad bodem, ale vždy celá uvnitř grafu.
    const left = Math.min(Math.max(px - tooltip.offsetWidth / 2, 0), width - tooltip.offsetWidth);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(py - tooltip.offsetHeight - 12, 0)}px`;
  };
  const hide = () => {
    guide.setAttribute('visibility', 'hidden');
    focus.setAttribute('visibility', 'hidden');
    tooltip.hidden = true;
  };
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerdown', show);
  // Myš: bublina zmizí po odjetí z grafu. Dotyk: zůstane, dokud se neklepne jinam do grafu.
  hit.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') hide(); });
  ui.bodyChartFigure.replaceChildren(svg, tooltip);
}

// ===== Záloha dat (v pohledu Historie) =====
async function onExportBackup() {
  const filename = `hypertrophica-zaloha-${log.localDate()}.json`;
  try {
    const data = backup.createBackup({
      sets: await log.getAllSets(),
      favorites: [...getFavorites()],
      week: plan.getWeek(),
      body: await body.getAll(),
    });
    // Odsazení 2 mezerami: soubor jde v případě potřeby přečíst i v textovém editoru.
    const result = await backup.saveFile(filename, JSON.stringify(data, null, 2), 'application/json');
    if (result !== 'cancelled') {
      ui.backupFeedback.textContent = t(result === 'shared' ? 'backup.shared' : 'backup.exported', { file: filename });
    }
  } catch (error) {
    console.error(error);
    ui.backupFeedback.textContent = t('backup.errorExport');
  }
}

// Tabulka sérií pro Excel; na rozdíl od zálohy JSON nejde importovat zpět.
async function onExportCsv() {
  const filename = `hypertrophica-${t('backup.csvFile')}-${log.localDate()}.csv`;
  try {
    const sets = await log.getAllSets();
    if (sets.length === 0) {
      ui.backupFeedback.textContent = t('backup.csvEmpty');
      return;
    }
    const csv = backup.createCsv(sets, (id) => localized(state.byId.get(id)?.name) || id, t('backup.csvHeader').split(','));
    const result = await backup.saveFile(filename, csv, 'text/csv');
    if (result !== 'cancelled') {
      ui.backupFeedback.textContent = t(result === 'shared' ? 'backup.shared' : 'backup.exportedCsv', { file: filename });
    }
  } catch (error) {
    console.error(error);
    ui.backupFeedback.textContent = t('backup.errorExport');
  }
}

// Tabulka měření (hmotnost a míry) pro Excel.
async function onExportBodyCsv() {
  const filename = `hypertrophica-${t('backup.bodyCsvFile')}-${log.localDate()}.csv`;
  try {
    const records = await body.getAll();
    if (records.length === 0) {
      ui.backupFeedback.textContent = t('backup.bodyCsvEmpty');
      return;
    }
    const csv = backup.createBodyCsv(records, t('backup.bodyCsvHeader').split(','));
    const result = await backup.saveFile(filename, csv, 'text/csv');
    if (result !== 'cancelled') {
      ui.backupFeedback.textContent = t(result === 'shared' ? 'backup.shared' : 'backup.exportedBodyCsv', { file: filename });
    }
  } catch (error) {
    console.error(error);
    ui.backupFeedback.textContent = t('backup.errorExport');
  }
}

// Vybraný soubor se přečte a zkontroluje; zatím se nic neukládá – nejdřív náhled s volbou.
async function onBackupFileChosen() {
  const file = ui.backupFile.files[0];
  ui.backupFile.value = ''; // aby šel stejný soubor vybrat znovu
  if (!file) return;
  closeImportPreview();
  let parsed;
  try {
    parsed = backup.parseBackup(await file.text(), new Set(state.byId.keys()));
  } catch (error) {
    if (!(error instanceof backup.BackupError)) console.error(error);
    ui.backupFeedback.textContent = t(error instanceof backup.BackupError ? error.key : 'backup.errorRead');
    return;
  }
  showImportPreview(parsed);
}

function showImportPreview(parsed) {
  const workouts = Array.isArray(parsed.week?.slots)
    ? parsed.week.slots.filter(Array.isArray).reduce((sum, ids) => sum + ids.length, 0)
    : 0;
  const date = parsed.exportedAt
    ? new Date(parsed.exportedAt).toLocaleString(currentLocale(), { dateStyle: 'medium', timeStyle: 'short' })
    : t('backup.unknownDate');
  const choice = (className, key, mode) => actionButton(className, t(key), () => onImportChoice(parsed, mode));
  ui.backupConfirm.replaceChildren(
    el('p', { textContent: t('backup.preview', {
      date, sets: parsed.sets.length, favorites: parsed.favorites.length, workouts, body: parsed.body.length,
    }) }),
    ...(parsed.skipped ? [el('p', { textContent: t('backup.previewSkipped', { count: parsed.skipped }) })] : []),
    ...(parsed.bodySkipped ? [el('p', { textContent: t('backup.previewBodySkipped', { count: parsed.bodySkipped }) })] : []),
    el('p', { className: 'backup-hint', textContent: t('backup.modeHint') }),
    el('div', { className: 'backup-actions' },
      choice('button-primary', 'backup.merge', 'merge'),
      choice('button-secondary', 'backup.replace', 'replace'),
      choice('button-secondary', 'backup.cancel', null)
    )
  );
  ui.backupConfirm.hidden = false;
  ui.backupFeedback.textContent = '';
  ui.backupConfirm.querySelector('button').focus();
}

function closeImportPreview() {
  ui.backupConfirm.hidden = true;
  ui.backupConfirm.replaceChildren();
}

async function onImportChoice(parsed, mode) {
  if (mode === 'replace' && !window.confirm(t('backup.replaceConfirm'))) return;
  closeImportPreview();
  ui.backupImport.focus();
  if (!mode) {
    ui.backupFeedback.textContent = t('backup.cancelled');
    return;
  }
  let result;
  let bodyResult;
  try {
    // Série a měření první: kdyby zápis do IndexedDB selhal, oblíbené a tréninky zůstanou beze změny.
    // (Každá tabulka se zapisuje samostatně – když selže až měření, série už zůstanou importované.)
    result = await log.importSets(parsed.sets, mode);
    bodyResult = await body.importRecords(parsed.body, mode);
  } catch (error) {
    console.error(error);
    ui.backupFeedback.textContent = t('backup.errorImport');
    return;
  }
  replaceFavorites(mode === 'replace'
    ? parsed.favorites
    : [...new Set([...getFavorites(), ...parsed.favorites])]);
  plan.importWeek(parsed.week, mode, new Set(state.byId.keys()));

  // Překresli vše, co oblíbené a tréninky zobrazuje.
  syncFilterControls();
  renderList();
  renderFavorites();
  afterPlanChange();
  // Historii a Tělo není třeba překreslovat – při otevření se načtou vždy znovu.
  ui.backupFeedback.textContent = `${t('backup.imported', result)} ${t('backup.importedBody', bodyResult)}`;
}
