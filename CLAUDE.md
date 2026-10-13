# Hypertrophica

Osobní wiki cviků pro hypertrofický trénink. Statická webová aplikace (PWA) hostovaná na GitHub Pages, ovládaná z PC i mobilu, funkční offline.

## Identita aplikace

- Název: **Hypertrophica** (lat. „věci týkající se hypertrofie“, tvar jako *Physica*, *Botanica*). Vždy přesně tento pravopis: `-troph-`, nikoli `-throp-`.
- Podtitul: **Exercise Wiki**
- Repozitář / slug: `hypertrophica` → URL `https://<user>.github.io/hypertrophica/`
- `manifest.json`: `"name": "Hypertrophica – Exercise Wiki"`, `"short_name": "Hypertrophica"`, `"start_url": "./"`, `"scope": "./"`, `"display": "standalone"`, `"lang": "cs"`
- `<title>` stránky: `Hypertrophica`

## Kontext autora

- Jediný editor obsahu je autor projektu.
- HTML zná okrajově, JavaScript nezná. **Každou netriviální změnu krátce vysvětli** (co a proč), komentuj kód tam, kde logika není zřejmá.
- Git se teprve učí. Před `commit`/`push` ukaž, co se commituje, a piš srozumitelné commit messages v angličtině (imperativ, např. `Add muscle filter`).

## Technické zásady

- **Vanilla HTML + CSS + JavaScript (ES modules). Žádný framework, žádný build krok, žádné npm závislosti v produkci.** GitHub Pages servíruje soubory přímo z větve `main`, kořenový adresář.
- Všechny cesty relativní (`./data/exercises.json`), protože web běží na podcestě `https://<user>.github.io/<repo>/`.
- Mobile-first responzivní layout. Ovládací prvky min. 44×44 px (dotyk).
- Podpora světlého i tmavého režimu přes `prefers-color-scheme` a CSS proměnné.
- Žádné externí CDN, fonty ani trackery – všechno lokálně kvůli offline režimu.
- Typografie: nadpisy a názvy cviků *Barlow Condensed* SemiBold 600 (proměnná `--font-display`), běžný text systémový font (`--font`). Soubory fontu jsou v `assets/fonts/` (licence OFL 1.1 v `assets/fonts/OFL.txt`).
- Přístupnost: sémantické HTML, `aria-label` u ikonových tlačítek, ovladatelnost klávesnicí.

## Funkce (rozsah v1)

1. **Seznam cviků** s vyhledáváním podle názvu (bez ohledu na diakritiku a velikost písmen).
2. **Filtry:** svalová skupina (primární/sekundární), typ (`compound` / `isolation`), vybavení, oblíbené. Filtry se kombinují (AND).
3. **Klikací schéma svalů** (SVG, přední a zadní pohled). Klik na sval → filtr podle svalu; aktivní sval zvýrazněn. Filtr jde nastavit i ze seznamu, schéma se synchronizuje.
4. **Detail cviku:** popis provedení, zapojené svaly, typ, vybavení, poznámky.
5. **Oblíbené:** hvězdička u cviku, ukládání do `localStorage` (klíč `hw.favorites`, pole ID). Přístup do `localStorage` vždy v `try/catch`; aplikace musí fungovat i bez něj.
6. **Offline (PWA):** `manifest.json` + service worker (`sw.js`) se strategií cache-first pro statické soubory. Cache verzovaná konstantou `CACHE_VERSION`. **Při každé změně obsahu nebo kódu zvyš `CACHE_VERSION`**, jinak mobil zobrazí starou verzi.

Mimo rozsah v1: uživatelské účty, backend, synchronizace oblíbených mezi zařízeními, obrázky/videa cviků.

## Rozsah v2: záznam sérií a záloha dat

7. **Záznam sérií:** v detailu cviku formulář hmotnost (kg) / opakování / RIR (nepovinné), dnešní série a souhrn posledních tréninků. Pohled **Historie** (`#/historie`) seskupený po dnech.
8. **Úložiště:** IndexedDB (databáze `hypertrophica`, tabulka `sets`, modul `js/log.js`), jeden záznam = jedna série. Při změně struktury zvyš `SCHEMA_VERSION` v `js/log.js` a doplň převod v `upgrade()`. Bez IndexedDB aplikace funguje se záznamy jen v paměti a upozorní na to.
9. **Záloha:** export/import JSON se všemi daty (série, oblíbené, tréninky) a export sérií do CSV (`js/backup.js`). Import kontroluje data a nabízí *Sloučit* / *Nahradit vše*.

Mimo rozsah v2: uživatelské účty a profily, backend, synchronizace mezi zařízeními (přenos jen přes soubor zálohy), jednotky lb.

## Struktura projektu

```
index.html
style.css
app.js              # vstupní bod, stav aplikace, render
js/                 # moduly: filters.js, favorites.js, bodymap.js, i18n.js, plan.js, theme.js, log.js, backup.js
data/
  exercises.json    # databáze cviků (hlavní editovaný soubor)
  muscles.json      # seznam svalových skupin (ID, názvy, latinské názvy, pohledy front/back)
i18n/
  cs.json           # texty UI
assets/
  body-map.svg      # schéma svalů, každý sval = element s id odpovídajícím muscles.json
  icons/            # PWA ikony 192 a 512 px
manifest.json
sw.js
README.md
```

## Datový model

`data/exercises.json` – pole objektů:

```json
{
  "id": "bench-press-barbell",
  "name": { "cs": "Bench press s osou", "en": "Barbell Bench Press" },
  "type": "compound",
  "primary": ["chest"],
  "secondary": ["front_delts", "triceps"],
  "equipment": ["barbell", "bench"],
  "description": { "cs": "...", "en": "" },
  "notes": { "cs": "", "en": "" }
}
```

- `id`: kebab-case, unikátní, nikdy se nemění (odkazují na něj oblíbené).
- `type`: pouze `"compound"` nebo `"isolation"`.
- `primary`/`secondary`: pouze ID existující v `muscles.json`.
- Klíče a ID anglicky, texty vícejazyčné. Aktuálně se vyplňuje jen `cs`; při chybějícím překladu zobraz `cs`.

`data/muscles.json` – pole objektů:

```json
{
  "id": "hamstrings",
  "name": { "cs": "Hamstringy", "en": "Hamstrings" },
  "latin": ["musculus biceps femoris", "musculus semitendinosus", "musculus semimembranosus"],
  "views": ["back"]
}
```

- `latin`: odborné názvy podle Terminologia Anatomica; pole, protože skupina může zahrnovat více svalů. Části svalu se zapisují jako `musculus deltoideus – pars clavicularis`.
- `views`: `"front"`, `"back"` nebo obojí (např. lýtka) – na kterém pohledu SVG schématu se sval zobrazí.

Při úpravě dat **validuj**: unikátní `id`, platné hodnoty `type`, existující ID svalů. Pro validaci vytvoř jednoduchý skript `tools/validate.html` (otevře se v prohlížeči a vypíše chyby), aby nebylo nutné instalovat Node.

Série (IndexedDB, tabulka `sets`, ne soubor v repozitáři) – objekt:

```json
{
  "id": "3f2c…",
  "exerciseId": "bench-press-barbell",
  "date": "2026-10-13",
  "reps": 8,
  "weightKg": 80,
  "rir": 2,
  "createdAt": "2026-10-13T18:22:05.000Z",
  "updatedAt": "2026-10-13T18:22:05.000Z"
}
```

- `id`: UUID, podle něj se při importu zálohy párují stejné série.
- `date`: den tréninku v místním čase; `reps` 1–100; `weightKg` 0–1000 (0 = vlastní váha); `rir` 0–10 nebo `null`.
- Záloha (JSON): `{ "app": "hypertrophica", "schemaVersion": 1, "exportedAt": "…", "sets": […], "favorites": […], "week": { "active": 0, "slots": [[…], …] } }`.

## Svalové skupiny (výchozí granularita)

Přední pohled: `chest`, `front_delts`, `side_delts`, `biceps`, `forearms`, `abs`, `obliques`, `quads`, `adductors`, `calves` (zobrazit i zezadu).
Zadní pohled: `rear_delts`, `traps`, `lats`, `upper_back` (rhomboidy, střední trapéz), `lower_back`, `triceps`, `glutes`, `hamstrings`, `abductors`.

## SVG schéma

- Zjednodušená stylizovaná postava, vlastní kresba (nepřebírat cizí grafiku bez ověřené licence).
- Každý klikatelný sval je samostatný `<path>` s `id` = ID svalu a `class="muscle"`.
- Párové svaly (levý/pravý) sdílejí `data-muscle` atribut, `id` mají unikátní (`biceps-l`, `biceps-r`).
- Barvy přes CSS proměnné (stav: neaktivní, hover, aktivní, sekundární zapojení).
- `assets/body-map.svg` se generuje skriptem `tools/generate-body-map.py` (tvary jsou definované jako body levé poloviny, pravá se zrcadlí). SVG ručně neupravuj – změň skript a spusť `python3 tools/generate-body-map.py`.
- Sval zobrazený na obou pohledech má na zadním pohledu id s příponou `-back` (`calves-back-l`), aby id byla v celém SVG unikátní.

## Testování

Primární způsob testování je **na nasazené verzi na GitHub Pages** (`https://<user>.github.io/hypertrophica/`), na PC i na mobilu. Autor pracuje výhradně přes Claude Code v cloudu a nemá lokální kopii repozitáře.

- GitHub Pages nasazuje pouze větev `main`, takže změnu z PR lze na Pages otestovat až po jeho sloučení (merge). Nasazení trvá obvykle 1–2 minuty.
- Před otevřením PR ověř změnu sám v cloudovém prostředí: spusť v kořeni projektu `python3 -m http.server 8000` a stránku zkontroluj v headless Chromiu (Playwright) – načtení bez chyb v konzoli, základní funkce, mobilní šířka (~375 px). Co a jak bylo ověřeno, uveď v popisu PR.
- Pokud se změna po nasazení na mobilu neprojeví, je to téměř vždy cache service workeru: zkontroluj, že byl zvýšen `CACHE_VERSION`, a stránku na mobilu znovu načti (případně zavři a znovu otevři nainstalovanou PWA).

### Lokální server (volitelné)

Jen pokud autor někdy bude mít lokální kopii: service worker a `fetch` nefungují přes `file://`, proto spusť v kořeni projektu `python -m http.server 8000` a otevři `http://localhost:8000`.

## Workflow

1. Před větší změnou navrhni postup a počkej na odsouhlasení.
2. **Každý úkol = samostatná větev a samostatný Pull Request do `main`.** Větev zakládej z aktuálního `main`. **Nikdy necommituj ani nepushuj přímo do `main`.**
3. Uvnitř větve dělej změny po malých logických krocích, každý krok = jeden commit.
4. Před pushem ověř funkčnost (viz *Testování*) a v odpovědi shrň, co se commituje.
5. Popis PR obsahuje:
   - **Co a proč** – stručně, srozumitelně pro autora (viz *Kontext autora*).
   - **Ověřeno před PR** – co bylo otestováno v cloudu.
   - **Po nasazení otestuj** – konkrétní checklist kroků, které má autor po merge provést na GitHub Pages, zvlášť pro **PC** a pro **mobil** (např. „Klepni na sval *biceps* → seznam ukáže jen cviky na biceps“).
   - Zda byl zvýšen `CACHE_VERSION` (pokud se měnil obsah nebo kód).
6. PR slučuje (merge) výhradně autor. Po merge ověří checklist; případné opravy = nová větev a nový PR.
7. `README.md` udržuj aktuální: jak přidat cvik, jak se nasazuje, jak testovat.
