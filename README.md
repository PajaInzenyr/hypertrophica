# Hypertrophica

Hypertrophica – Exercise Wiki. Osobní wiki cviků pro hypertrofický trénink. Statická webová aplikace (vanilla HTML, CSS, JavaScript) hostovaná na GitHub Pages.

- Web: `https://pajainzenyr.github.io/hypertrophica/`
- Data cviků: [`data/exercises.json`](data/exercises.json)
- Svalové skupiny: [`data/muscles.json`](data/muscles.json)
- Texty rozhraní: [`i18n/cs.json`](i18n/cs.json)

## Tréninky 1–4 a Týden

Jednoduché plány tréninků: až 4 tréninky (*Trénink 1–4*), každý je seřazený seznam cviků, bez sérií, opakování a vah. Záložka *Týden* ukazuje, které partie tréninky dohromady zapojily a které zůstaly vynechané.

- **Přepínač:** v pohledu tréninku řada tlačítek *1 2 3 4 Týden*. Malé číslo u tlačítka = počet cviků v tréninku. Klepnutí na 1–4 udělá trénink **aktivním**.
- **Přidání / odebrání:** tlačítko ⊕ vedle cviku v seznamu nebo v detailu přidává do **aktivního** tréninku (✓ = cvik už v něm je). Nový cvik se přidá na konec. Stejný cvik může být ve více trénincích.
- **Zobrazení:** ikona seznamu v hlavičce (odznak = počet cviků v aktivním tréninku), adresa `#/trenink`; souhrn týdne na adrese `#/tyden`.
- **Pořadí:** šipky ↑ ↓ u cviku, × cvik odebere, *Vymazat trénink* smaže aktivní trénink.
- **Zámek:** ikona zámku vedle nadpisu. Platí pro všechny tréninky najednou. Zamčené tréninky skryjí šipky, křížky, *Vymazat trénink* i *Nový týden* a cvik nejde odebrat ani tlačítkem ✓ v seznamu či detailu – ochrana proti nechtěnému klepnutí během cvičení. Stav zámku se ukládá v `localStorage` pod klíčem `hw.planLocked`.
- **Partie v tréninku:** pod seznamem cviků je schéma postavy. Plnou barvou svaly, které jsou u některého cviku primární, světlejší barvou svaly zapojené jen sekundárně. Na každé zapojené partii je malé číslo = počet cviků v tréninku, které ji zapojují (primárně i sekundárně). Schéma je i u sdíleného tréninku.
- **Týden:** sečte cviky ze všech 4 tréninků (cvik ve dvou trénincích se počítá dvakrát). Partie je **zapojená**, když ji zapojuje aspoň 1 cvik primárně **nebo** aspoň 2 cviky sekundárně (pravidlo je v `app.js`, konstanty `WEEK_MIN_PRIMARY` a `WEEK_MIN_SECONDARY`). Partie s jediným sekundárním cvikem je **nedostatečně zapojená**, partie bez cviku **vynechaná**. Na schématu: zapojené plnou barvou, nedostatečně světlejší, vynechané bez barvy; číslo = počet cviků za týden. Pod schématem jsou vynechané a nedostatečně zapojené partie jako tlačítka – klepnutí otevře seznam cviků, které partii zapojují primárně. *Nový týden* vymaže všechny 4 tréninky.
- **Uložení:** v `localStorage` pod klíčem `hw.week` (`{ "active": 0, "slots": [[…], […], […], […]] }`, `active` = index aktivního tréninku 0–3) – jen v daném prohlížeči a zařízení. Trénink uložený starší verzí aplikace (klíč `hw.plan`) se při prvním spuštění automaticky přesune do *Tréninku 1*.
- **Sdílení:** *Kopírovat odkaz* (na mobilu i *Sdílet*) vytvoří adresu `…/hypertrophica/#/trenink?cviky=id1,id2,…` s aktivním tréninkem. Kdo ji otevře, uvidí náhled tréninku a může ho tlačítkem *Uložit jako můj trénink N* převzít (nahradí jeho aktivní trénink). Odkaz obsahuje jen ID cviků, nic se neukládá na server.

Protože odkazy a uložené tréninky používají `id` cviků, je o to důležitější `id` existujícího cviku neměnit. Cviky, které už v datech nejsou, se z tréninku i ze sdíleného odkazu tiše vynechají.

## Jak přidat cvik

Cviky jsou v souboru `data/exercises.json`. Je to seznam (pole) objektů oddělených čárkou; nový cvik vlož k ostatním cvikům na stejnou partii.

```json
{
  "id": "incline-curl-dumbbell",
  "name": { "cs": "Bicepsový zdvih na šikmé lavici", "en": "Incline Dumbbell Curl" },
  "type": "isolation",
  "primary": ["biceps"],
  "secondary": [],
  "equipment": ["dumbbell", "bench"],
  "description": { "cs": "Popis provedení…", "en": "" },
  "notes": { "cs": "Tipy, varianty, bezpečnost…", "en": "" }
}
```

| Pole | Co do něj patří |
|---|---|
| `id` | Unikátní identifikátor v kebab-case (malá písmena, slova oddělená pomlčkou). **Po přidání ho už neměň** – odkazují na něj uložené oblíbené, trénink i sdílené odkazy. |
| `name` | Název česky (`cs`) a anglicky (`en`). |
| `type` | Pouze `"compound"` (vícekloubový) nebo `"isolation"` (izolovaný). |
| `primary` | Hlavní zapojené svaly – ID z tabulky níže. |
| `secondary` | Pomocné svaly – ID z tabulky níže, může být prázdné `[]`. Stejný sval nedávej do `primary` i `secondary`. |
| `equipment` | Potřebné vybavení – ID z tabulky níže. Uveď **vše, co je potřeba současně** (např. `["dumbbell", "bench"]`). |
| `description` | Popis provedení. Vyplňuje se `cs`, `en` může zůstat `""`. |
| `notes` | Poznámky (varianty, tipy). Může zůstat `""`. |

Chybí-li anglický text, aplikace zobrazí český.

### Svalové skupiny (`primary`, `secondary`)

| ID | Název | | ID | Název |
|---|---|---|---|---|
| `chest` | Prsa | | `rear_delts` | Zadní delty |
| `front_delts` | Přední delty | | `traps` | Trapézy |
| `side_delts` | Boční delty | | `lats` | Široké zádové svaly |
| `biceps` | Biceps | | `upper_back` | Horní záda |
| `forearms` | Předloktí | | `lower_back` | Spodní záda |
| `abs` | Břišní svaly | | `triceps` | Triceps |
| `obliques` | Šikmé břišní svaly | | `glutes` | Hýžďové svaly |
| `quads` | Kvadricepsy | | `hamstrings` | Hamstringy |
| `adductors` | Přitahovače stehen | | `abductors` | Odtahovače stehen |
| `calves` | Lýtka | | | |

Nová svalová skupina vyžaduje změnu `data/muscles.json` i SVG schématu (`tools/generate-body-map.py`) – to už není běžná úprava dat.

### Vybavení (`equipment`)

| ID | Název ve filtru | Kdy použít |
|---|---|---|
| `barbell` | Osa | Olympijská nebo rovná osa |
| `ez_bar` | EZ osa | Lomená osa |
| `dumbbell` | Jednoručky | |
| `cable` | Kladka | |
| `machine` | Stroj | Posilovací stroj s vlastní dráhou pohybu |
| `smith_machine` | Smithův stroj | Osa vedená v pevných kolejnicích; lavici uveď zvlášť (`bench`) |
| `bench` | Lavice | Rovná, šikmá i Scottova lavice |
| `squat_rack` | Klec / stojany | |
| `pullup_bar` | Hrazda | |
| `back_extension_bench` | Lavice na hyperextenze | |
| `dip_bars` | Bradla | |
| `rings` | Kruhy | Gymnastické kruhy |
| `bodyweight` | Vlastní váha | Zátěží je hlavně vlastní tělo. Uváděj vždy, i když cvik potřebuje ještě další vybavení (např. `["bodyweight", "pullup_bar"]`), aby ho našel filtr „Vlastní váha“. |
| `unspecified` | Nedefinováno | Cvik potřebuje pomůcku, která není pevně daná (např. Australský shyb – jakákoli tyč ve výšce pasu; Nordic curl – cokoli na zafixování pat). Konkrétní možnosti popiš v `notes`. |

Filtr vybavení nabízí jen hodnoty, které má aspoň jeden cvik – nově přidané vybavení bez cviku se v nabídce neukáže.

**Nové vybavení** přidáš tak, že jeho ID a český název doplníš do `i18n/cs.json` do sekce `"equipment"` a zapíšeš ho do tabulky výše. Bez záznamu v `i18n/cs.json` by se ve filtru zobrazilo technické ID místo názvu.

### Kontrola před uložením

- `id` je unikátní a v kebab-case.
- `type` je `compound` nebo `isolation`.
- Všechna ID svalů a vybavení jsou z tabulek výše.
- JSON je platný: řetězce v uvozovkách `"`, mezi objekty čárka, za posledním objektem čárka **není**.
- V `sw.js` je zvýšený `CACHE_VERSION` (viz *Offline režim*).

## Nasazení

GitHub Pages servíruje soubory přímo z větve `main` (kořenový adresář), bez build kroku. Každá změna jde přes samostatnou větev a Pull Request; po sloučení (merge) do `main` je web obvykle do 1–2 minut aktualizovaný.

## Offline režim a instalace na mobil

Aplikace je PWA: `manifest.json` popisuje název a ikony, service worker `sw.js` ukládá všechny soubory do cache prohlížeče, takže po prvním načtení funguje i bez internetu.

- **Android (Chrome):** menu ⋮ → *Přidat na plochu* / *Nainstalovat aplikaci*.
- **iPhone (Safari):** tlačítko Sdílet → *Přidat na plochu*.

**Při každé změně obsahu nebo kódu zvyš `CACHE_VERSION` v `sw.js`** (např. `1` → `2`). Service worker servíruje soubory z cache; novou verzi prohlížeč pozná jen podle změny `sw.js`. Po nasazení se nová verze stáhne při otevření aplikace a zobrazí se po dalším obnovení stránky (u nainstalované aplikace ji zavři a znovu otevři).

Přidáš-li nový soubor (JS modul, obrázek…), doplň ho i do seznamu `FILES` v `sw.js`, jinak nebude dostupný offline.

Ikony v `assets/icons/` generuje skript `python3 tools/generate-icons.py` (vyžaduje Pillow) – ručně je neupravuj.

## Testování

- **Po merge** otestuj změnu na `https://pajainzenyr.github.io/hypertrophica/` na PC i na mobilu podle checklistu v popisu PR.
- **Před PR** se změna ověřuje v cloudovém prostředí: lokální server `python3 -m http.server 8000` v kořeni projektu a kontrola v headless prohlížeči (načtení bez chyb, filtry, trénink, mobilní šířka ~375 px).
- Pokud se změna na webu neprojeví, je to téměř vždy cache service workeru: zkontroluj, že byl zvýšen `CACHE_VERSION`, a stránku obnov dvakrát (nainstalovanou aplikaci zavři a znovu otevři).
- Spuštění z disku (`file://`) nefunguje, protože prohlížeč tak nenačte data přes `fetch` – vždy použij lokální server a otevři `http://localhost:8000`.
