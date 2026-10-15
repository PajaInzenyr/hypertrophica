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

// ===== Stav aplikace =====
const state = {
  exercises: [],
  byId: new Map(), // id cviku → objekt z exercises.json
  muscles: new Map(), // id svalu → objekt z muscles.json
  filters: { ...EMPTY_FILTERS },
  view: null, // právě zobrazený pohled: 'list' | 'detail' | 'plan' | 'history' | 'settings'
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
  backupImport: $('backup-import'),
  backupFile: $('backup-file'),
  backupConfirm: $('backup-confirm'),
  backupFeedback: $('backup-feedback'),
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
  ui.backupImport.addEventListener('click', () => ui.backupFile.click());
  ui.backupFile.addEventListener('change', onBackupFileChosen);
  ui.historyMore.addEventListener('click', () => {
    state.historyDays += HISTORY_PAGE;
    renderHistory();
  });
  ui.calendarPrev.addEventListener('click', () => shiftCalendarMonth(-1));
  ui.calendarNext.addEventListener('click', () => shiftCalendarMonth(1));
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
// #/nastaveni = nastavení (motiv, záloha a obnova dat)
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
  // Zvýrazní ikonu tréninku / historie / nastavení v hlavičce, když je pohled otevřený.
  [[ui.planLink, 'plan'], [ui.historyLink, 'history'], [ui.settingsLink, 'settings']].forEach(([link, view]) => {
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
// step = o kolik tlačítka mění hodnotu; start = hodnota po klepnutí na + u prázdného políčka.
function stepperField({ id, label, hint, inputMode, step, start, min, max }) {
  const input = el('input', { id, type: 'text', inputMode, autocomplete: 'off', className: 'log-input' });
  const change = (direction) => {
    const value = parseNumber(input.value);
    if (value === null || Number.isNaN(value)) {
      if (direction > 0) input.value = formatNumber(start);
      return;
    }
    input.value = formatNumber(Math.min(max, Math.max(min, value + direction * step)));
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

// ===== Záloha dat (v pohledu Historie) =====
async function onExportBackup() {
  const filename = `hypertrophica-zaloha-${log.localDate()}.json`;
  try {
    const data = backup.createBackup({
      sets: await log.getAllSets(),
      favorites: [...getFavorites()],
      week: plan.getWeek(),
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
      date, sets: parsed.sets.length, favorites: parsed.favorites.length, workouts,
    }) }),
    ...(parsed.skipped ? [el('p', { textContent: t('backup.previewSkipped', { count: parsed.skipped }) })] : []),
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
  try {
    // Série první: kdyby zápis do IndexedDB selhal, oblíbené a tréninky zůstanou beze změny.
    result = await log.importSets(parsed.sets, mode);
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
  // Historii není třeba překreslovat – při otevření se načte vždy znovu.
  ui.backupFeedback.textContent = t('backup.imported', result);
}
