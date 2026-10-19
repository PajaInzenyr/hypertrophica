# Hypertrophica

[English](README.md) · **Čeština**

**Hypertrophica – Exercise Wiki.** Osobní příručka cviků pro hypertrofický trénink (budování svalové hmoty): najdi cvik podle svalu, sestav si tréninky na týden, zapisuj série a sleduj, jak se zlepšuješ. Funguje v prohlížeči na PC i na mobilu, dá se nainstalovat jako aplikace a běží i bez internetu.

👉 **Otevřít aplikaci: <https://pajainzenyr.github.io/hypertrophica/>**

![Seznam cviků na PC: vlevo schéma svalů se zvýrazněnými prsy, uprostřed filtrovaný seznam cviků, vpravo oblíbené](docs/screenshots/desktop-list.png)

> Název *Hypertrophica* je latinsky „věci týkající se hypertrofie“ – po vzoru starých učebnic jako *Physica* nebo *Botanica*.

---

## Myšlenka

Při tréninku na objem se pořád řeší stejné otázky: *Čím procvičím zadní delty? Co můžu dělat jen s jednoručkami? Nevynechávám v týdnu nějakou partii? Kolik jsem minule zvedl na benchi?* Odpovědi bývají rozházené po videích, poznámkách v mobilu a v hlavě.

Hypertrophica je dává na jedno místo:

- **Wiki cviků** – každý cvik má popis provedení, primárně a sekundárně zapojené svaly, typ a potřebné vybavení.
- **Pohled přes svaly** – klikací schéma postavy: klepneš na sval a vidíš cviky, které ho zapojují.
- **Plán a kontrola týdne** – až 4 tréninky a souhrn, které partie týden pokrývá a které zůstávají stranou.
- **Tréninkový deník** – zápis sérií přímo u cviku a historie s kalendářem.

Zásady, na kterých aplikace stojí:

- **Jednoduchost.** Žádné účty, registrace ani reklamy. Otevřeš a používáš.
- **Soukromí.** Data (oblíbené, tréninky, série) zůstávají jen ve tvém zařízení. Nic se neodesílá na server; přenos mezi zařízeními jde přes soubor zálohy.
- **Offline.** Po prvním načtení funguje i v posilovně bez signálu.
- **Mobil na prvním místě.** Velká tlačítka pro ovládání palcem, světlý i tmavý režim.

---

## Co aplikace umí

| Funkce | Krátce |
|---|---|
| 🔎 **Vyhledávání** | Hledání cviku podle názvu, nezáleží na diakritice ani velikosti písmen („drep“ najde „Dřep“). |
| 🎛️ **Filtry** | Sval (primární / sekundární zapojení), typ (vícekloubový / izolovaný), vybavení, oblíbené. Filtry se kombinují. |
| 🧍 **Schéma svalů** | Postava zepředu a zezadu. Klepnutí na sval = filtr podle svalu, aktivní sval je zvýrazněný. |
| 📖 **Detail cviku** | Provedení, zapojené svaly (i na schématu), typ, vybavení, poznámky a tipy. |
| ⭐ **Oblíbené** | Hvězdička u cviku, rychlý seznam oblíbených. |
| 📋 **Tréninky 1–4** | Seřazené seznamy cviků, schéma zapojených partií, sdílení odkazem, zámek proti nechtěným úpravám. |
| 📅 **Týden** | Souhrn všech tréninků: které partie jsou zapojené, nedostatečně zapojené nebo vynechané. |
| 🏋️ **Záznam sérií** | Hmotnost, opakování a RIR přímo v detailu cviku, předvyplnění podle minula, souhrn posledních tréninků. |
| 🕘 **Historie** | Všechny série po dnech a kalendář tréninků. |
| 📏 **Tělo** | Hmotnost, tělesný tuk a tělesné míry (pas, paže…) s grafem vývoje. |
| 💾 **Záloha** | Export / import všech dat do souboru JSON, export sérií a měření těla do CSV pro Excel. |
| 🌗 **Motiv** | Světlý, tmavý nebo podle systému. |
| 🌐 **Jazyk** | Čeština nebo angličtina, výchozí podle jazyka prohlížeče. |
| 📱 **Instalace (PWA)** | Přidání na plochu telefonu, běh bez internetu. |

Databáze obsahuje desítky cviků na 19 svalových skupin a průběžně se rozšiřuje.

<p>
  <img src="docs/screenshots/mobile-plan.png" width="200" alt="Trénink 1 na mobilu: seřazený seznam cviků s počtem dnešních sérií">
  <img src="docs/screenshots/mobile-week.png" width="200" alt="Souhrn týdne: schéma postavy se zapojenými partiemi a počty cviků">
  <img src="docs/screenshots/mobile-log.png" width="200" alt="Detail cviku: formulář pro zápis série, dnešní série a předchozí tréninky">
  <img src="docs/screenshots/mobile-history-dark.png" width="200" alt="Historie v tmavém režimu: kalendář tréninků a série po dnech">
  <img src="docs/screenshots/mobile-settings.png" width="200" alt="Nastavení: volba motivu a jazyka (Systém, Čeština, English) a záloha dat">
</p>

*Zleva: trénink, souhrn týdne, záznam sérií v detailu cviku, historie v tmavém režimu, nastavení s volbou motivu a jazyka.*

---

## Rychlý start

1. **Otevři** <https://pajainzenyr.github.io/hypertrophica/> v prohlížeči.
2. **Nainstaluj na mobil** (doporučeno, aplikace pak funguje jako běžná appka i offline):
   - **Android (Chrome):** menu ⋮ → *Přidat na plochu* / *Nainstalovat aplikaci*.
   - **iPhone (Safari):** tlačítko Sdílet → *Přidat na plochu*.
3. **Najdi cvik** – napiš název do vyhledávání, nebo klepni na sval ve schématu.
4. **Sestav trénink** – tlačítkem ⊕ u cviku ho přidáš do aktivního tréninku. Tréninky otevřeš ikonou seznamu v hlavičce.
5. **Při cvičení zapisuj série** – v detailu cviku sekce *Záznam*: hmotnost, opakování, *Přidat sérii*.
6. **Občas zálohuj** – *Nastavení* → *Exportovat zálohu (JSON)*. Data jsou jen v tomto zařízení.

---

## Průvodce funkcemi

### Seznam cviků, filtry a schéma svalů

- **Vyhledávání** podle názvu, bez ohledu na diakritiku a velká písmena.
- **Filtry:** *Sval* (a u něj *Zapojení*: primární / sekundární / obojí), *Typ*, *Vybavení* a *Oblíbené*. Všechny platí současně. *Zrušit filtry* vše vrátí.
- **Schéma svalů:** přepínání *Zepředu* / *Zezadu*, klepnutí na sval nastaví filtr, další klepnutí ho zruší. Filtr nastavený v seznamu se na schématu zvýrazní taky.
- Filtr *Vybavení* nabízí jen vybavení, které má aspoň jeden cvik.

### Detail cviku

Popis provedení, primární a sekundární svaly (i barevně na schématu), typ, vybavení a poznámky (varianty, tipy, bezpečnost). Hvězdička přidá cvik do oblíbených, ⊕ do aktivního tréninku. Pod tím je sekce *Záznam* pro zápis sérií.

**Návrat z detailu:** odkaz *← Zpět na …* nahoře, klávesa **Esc**, nebo na PC (šířka od 900 px) klik do prázdného místa vlevo či vpravo od obsahu. Když je kurzor v políčku formuláře *Záznam*, první Esc políčko jen opustí, druhý se vrátí zpět. Na mobilu jen odkazem (okraje jsou úzké a hrozilo by nechtěné zavření detailu).

### Oblíbené

Hvězdička u cviku v seznamu nebo v detailu. Oblíbené cviky jsou v samostatném panelu a dají se použít jako filtr.

### Tréninky 1–4 a Týden

Jednoduché plány tréninků: až 4 tréninky (*Trénink 1–4*), každý je seřazený seznam cviků, bez sérií, opakování a vah. Záložka *Týden* ukazuje, které partie tréninky dohromady zapojily a které zůstaly vynechané.

- **Přepínač:** v pohledu tréninku řada tlačítek *1 2 3 4 Týden*. Malé číslo u tlačítka = počet cviků v tréninku. Klepnutí na 1–4 udělá trénink **aktivním**.
- **Přidání / odebrání:** tlačítko ⊕ vedle cviku v seznamu nebo v detailu přidává do **aktivního** tréninku (✓ = cvik už v něm je). Nový cvik se přidá na konec. Stejný cvik může být ve více trénincích.
- **Zobrazení:** ikona seznamu v hlavičce (odznak = počet cviků v aktivním tréninku), adresa `#/trenink`; souhrn týdne na adrese `#/tyden`.
- **Odcvičeno dnes:** cvik, u kterého jsou dnes zapsané série, má v pravém horním rohu karty kroužek s počtem dnešních sérií. Další den kroužky zmizí.
- **Pořadí:** šipky ↑ ↓ u cviku, × cvik odebere, *Vymazat trénink* smaže aktivní trénink.
- **Zámek:** ikona zámku vedle nadpisu, platí pro všechny tréninky najednou. Zamčené tréninky skryjí šipky, křížky, *Vymazat trénink* i *Nový týden* a cvik nejde odebrat ani tlačítkem ✓ v seznamu či detailu – ochrana proti nechtěnému klepnutí během cvičení.
- **Partie v tréninku:** pod seznamem cviků je schéma postavy. Plnou barvou svaly, které jsou u některého cviku primární, světlejší barvou svaly zapojené jen sekundárně. Číslo na partii = počet cviků v tréninku, které ji zapojují.
- **Týden:** sečte cviky ze všech 4 tréninků (cvik ve dvou trénincích se počítá dvakrát). Partie je
  - **zapojená**, když ji zapojuje aspoň 1 cvik primárně **nebo** aspoň 2 cviky sekundárně (plná barva),
  - **nedostatečně zapojená**, když ji zapojuje jen 1 cvik sekundárně (světlejší barva),
  - **vynechaná**, když ji nezapojuje žádný cvik (bez barvy).

  Pod schématem jsou vynechané a nedostatečně zapojené partie jako tlačítka – klepnutí otevře cviky, které partii zapojují primárně. *Nový týden* vymaže všechny 4 tréninky.
- **Sdílení:** *Kopírovat odkaz* (na mobilu i *Sdílet*) vytvoří adresu `…/hypertrophica/#/trenink?cviky=id1,id2,…` s aktivním tréninkem. Kdo ji otevře, uvidí náhled tréninku a tlačítkem *Uložit jako můj trénink N* ho může převzít (nahradí jeho aktivní trénink). Odkaz obsahuje jen ID cviků, nic se neukládá na server.

### Záznam sérií a historie

- **Zápis:** v detailu cviku sekce *Záznam*: hmotnost v kg (desetinná čárka i tečka, `0` = vlastní váha), počet opakování a nepovinně **RIR** (*reps in reserve* – kolik opakování zbývalo do selhání, 0–10). Tlačítka − a + mění hodnotu bez psaní (hmotnost po 2,5 kg). *Přidat sérii* sérii uloží; hodnoty ve formuláři zůstanou, takže další stejnou sérii zapíšeš jedním klepnutím.
- **Předvyplnění:** při otevření detailu se formulář vyplní hodnotami poslední zapsané série cviku.
- **V detailu** je seznam dnešních sérií (× sérii smaže) a souhrn posledních 5 tréninků cviku, např. `80 kg × 8, 8, 7 · 85 kg × 6` (po sobě jdoucí série se stejnou hmotností se sloučí).
- **Historie:** ikona hodin v hlavičce, adresa `#/historie`. Všechny série po dnech (nejnovější nahoře), v rámci dne po cvicích. Zobrazuje se 20 dní, starší přidá *Zobrazit starší*. Kalendář (na PC vlevo, na mobilu nad seznamem) zvýrazní dny s tréninkem; klepnutí na den přeskočí na jeho záznam.

### Hmotnost a tělesné míry

- **Kde:** ikona krejčovského metru v hlavičce, adresa `#/telo`.
- **Nové měření:** datum (výchozí dnešek), hmotnost (kg), tělesný tuk (%) a v rozbalovací části *Míry (cm)* krk, hrudník, pas, boky, paže (zatnutá), stehno a lýtko. Všechna pole jsou nepovinná, vyplň aspoň jedno. Tlačítka − a + mění hodnotu bez psaní; + u prázdného políčka začne od poslední zapsané hodnoty.
- **Jedno měření na den:** když zvolíš den, pro který už je měření uložené, formulář se jím vyplní a uložení ho upraví.
- **Aktuální stav:** dlaždice pro každou zapsanou míru s poslední hodnotou a změnou oproti předchozímu měření (např. `−0,6 od 12. 10.`). Klepnutí na dlaždici zobrazí míru v grafu.
- **Graf:** vývoj vybrané míry v čase (*3 měsíce* / *Rok* / *Vše*); najetí myší nebo klepnutí ukáže hodnotu nejbližšího měření. Na PC je graf v levém sloupci.
- **Seznam měření:** od nejnovějšího, tužka načte den do formuláře, × ho smaže.

### Nastavení, záloha a obnova dat

Ikona posuvníků v hlavičce, adresa `#/nastaveni`. Z konce *Historie* sem vede odkaz *Záloha a obnova dat*.

- **Motiv:** *Systém* (podle nastavení zařízení) / *Světlý* / *Tmavý*.
- **Jazyk:** *Systém* / *Čeština* / *English*. *Systém* = podle jazyka prohlížeče (čeština a slovenština → česky, jinak anglicky). Po změně se stránka sama znovu načte. Vyhledávání najde cvik podle českého i anglického názvu bez ohledu na zvolený jazyk.
- **Exportovat zálohu (JSON):** stáhne soubor `hypertrophica-zaloha-RRRR-MM-DD.json` se **všemi** daty – série, oblíbené, tréninky 1–4 i měření těla. Ulož ho na bezpečné místo (Disk Google, e-mail sám sobě…).
- **Importovat zálohu:** vyber soubor zálohy. Aplikace ho zkontroluje a ukáže, co obsahuje. Pak zvol:
  - **Sloučit s daty v zařízení** – přidá série a měření, které v zařízení chybí (stejná série se nezdvojí; u dne změřeného v obou se ponechá naposledy upravené měření), sjednotí oblíbené a doplní jen prázdné tréninky.
  - **Nahradit vše** – po potvrzení smaže data v zařízení a obnoví je ze zálohy.
  - Neplatné série a měření a série cviků, které už v datech nejsou, se vynechají (náhled uvede jejich počet).
  - Zálohy ze starších verzí (bez měření těla) jdou importovat i nadále.
- **Exportovat série (CSV):** tabulka pro Excel / Tabulky Google (`hypertrophica-serie-RRRR-MM-DD.csv`, sloupce `datum;cvik;id_cviku;série;opakování;hmotnost_kg;rir`, středník a desetinná čárka; v angličtině `hypertrophica-sets-…csv` s anglickými názvy sloupců a cviků, formát stejný). Slouží k prohlížení a grafům – **zpět importovat nejde**, na to je záloha JSON.
- **Exportovat měření těla (CSV):** `hypertrophica-mereni-RRRR-MM-DD.csv` (v angličtině `hypertrophica-measurements-…csv`), jeden řádek = jeden den, sloupce `datum;hmotnost_kg;tuk_procent;krk_cm;hrudnik_cm;pas_cm;boky_cm;paze_cm;stehno_cm;lytko_cm`; prázdná buňka = neměřeno. Stejně jako CSV sérií jen pro export.
- **Přenos na jiné zařízení:** export JSON na starém zařízení → přenést soubor → import na novém.
- **O aplikaci:** úplně dole – krátký tip k instalaci aplikace na mobil, autor, odkaz na zdrojový kód na GitHubu, licence (MIT) a licence písma nadpisů.

### Kde jsou tvoje data

Všechno se ukládá **jen v prohlížeči daného zařízení**, nic neodchází na server:

| Data | Úložiště |
|---|---|
| Oblíbené | `localStorage`, klíč `hw.favorites` |
| Tréninky 1–4 | `localStorage`, klíč `hw.week` (`{ "active": 0, "slots": [[…], […], […], […]] }`) |
| Zámek tréninků | `localStorage`, klíč `hw.planLocked` |
| Motiv | `localStorage`, klíč `hw.theme` |
| Jazyk | `localStorage`, klíč `hw.lang` (bez klíče = podle prohlížeče) |
| Série | IndexedDB, databáze `hypertrophica`, tabulka `sets` (modul `js/log.js`) |
| Hmotnost a míry | IndexedDB, databáze `hypertrophica`, tabulka `body` (modul `js/body.js`) |

- Smazáním dat prohlížeče se data ztratí – proto **pravidelně zálohuj**.
- Aplikace při prvním zápisu série požádá prohlížeč o trvalé úložiště (`navigator.storage.persist()`), aby data nemazal při nedostatku místa.
- **iPhone:** používej aplikaci přidanou na plochu – Safari jinak data webu, který se 7 dní neotevřel, maže.
- Trénink uložený starší verzí aplikace (klíč `hw.plan`) se při prvním spuštění automaticky přesune do *Tréninku 1*.

---

## Pro správce obsahu

Tato část je pro toho, kdo aplikaci upravuje – přidává cviky nebo mění kód.

### Jak aplikace funguje technicky

- Statická webová aplikace: **vanilla HTML, CSS a JavaScript** (ES moduly), bez frameworku, bez build kroku a bez externích knihoven, fontů či trackerů.
- Hostovaná na **GitHub Pages** přímo z větve `main`.
- Obsah je v souborech JSON, aplikace je načítá při spuštění.

```
index.html          # stránka
style.css           # vzhled
app.js              # vstupní bod, stav aplikace, vykreslování
js/                 # moduly: filtry, oblíbené, schéma, tréninky, záznam sérií, míry těla, záloha, motiv, texty
data/
  exercises.json    # databáze cviků (hlavní editovaný soubor)
  muscles.json      # svalové skupiny
i18n/              # texty rozhraní: cs.json (čeština), en.json (angličtina)
assets/             # schéma svalů (SVG), ikony, font
manifest.json       # popis PWA (název, ikony)
sw.js               # service worker – offline režim
tools/              # kontrola dat (validate.html), skripty pro generování SVG schématu a ikon
docs/screenshots/   # snímky obrazovky pro README.md a README.cs.md (aplikace je nepoužívá)
```

- Data cviků: [`data/exercises.json`](data/exercises.json)
- Svalové skupiny: [`data/muscles.json`](data/muscles.json)
- Texty rozhraní: [`i18n/cs.json`](i18n/cs.json), [`i18n/en.json`](i18n/en.json) – oba soubory musí mít stejné klíče; nový text přidej do obou.

### Jak přidat cvik

Cviky jsou v souboru `data/exercises.json`. Je to seznam (pole) objektů oddělených čárkou; nový cvik vlož k ostatním cvikům na stejnou partii.

```json
{
  "id": "incline-curl-dumbbell",
  "name": { "cs": "Bicepsový zdvih na šikmé lavici", "en": "Incline Dumbbell Curl" },
  "type": "isolation",
  "primary": ["biceps"],
  "secondary": [],
  "equipment": ["dumbbell", "bench"],
  "description": { "cs": "Popis provedení…", "en": "How to perform…" },
  "notes": { "cs": "Tipy, varianty, bezpečnost…", "en": "Tips, variations, safety…" }
}
```

| Pole | Co do něj patří |
|---|---|
| `id` | Unikátní identifikátor v kebab-case (malá písmena, slova oddělená pomlčkou). **Po přidání ho už neměň** – odkazují na něj uložené oblíbené, tréninky, série i sdílené odkazy. |
| `name` | Název česky (`cs`) a anglicky (`en`). |
| `type` | Pouze `"compound"` (vícekloubový) nebo `"isolation"` (izolovaný). |
| `primary` | Hlavní zapojené svaly – ID z tabulky níže. |
| `secondary` | Pomocné svaly – ID z tabulky níže, může být prázdné `[]`. Stejný sval nedávej do `primary` i `secondary`. |
| `equipment` | Potřebné vybavení – ID z tabulky níže. Uveď **vše, co je potřeba současně** (např. `["dumbbell", "bench"]`). |
| `description` | Popis provedení česky (`cs`) a anglicky (`en`). |
| `notes` | Poznámky (varianty, tipy) česky a anglicky. Může zůstat `""`. |

Chybí-li anglický text, aplikace v angličtině zobrazí český – nový cvik proto ideálně vyplň v obou jazycích. Cviky, které už v datech nejsou, se z tréninků i sdílených odkazů tiše vynechají.

#### Svalové skupiny (`primary`, `secondary`)

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

#### Vybavení (`equipment`)

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

**Nové vybavení** přidáš tak, že jeho ID a název doplníš do `i18n/cs.json` (česky) i `i18n/en.json` (anglicky) do sekce `"equipment"` a zapíšeš ho do tabulky výše (v obou README). Bez záznamu v `i18n` by se ve filtru zobrazilo technické ID místo názvu.

#### Kontrola před uložením

Data zkontroluje stránka **[`tools/validate.html`](tools/validate.html)** – otevři ji v prohlížeči na <https://pajainzenyr.github.io/hypertrophica/tools/validate.html> (nebo lokálně `http://localhost:8000/tools/validate.html`). Vypíše chyby červeně a upozornění žlutě; když je vše v pořádku, ukáže zelené *✓ Vše v pořádku*. Kontroluje:

- cviky: unikátní `id` v kebab-case, `type`, existující svaly a vybavení, sval ne zároveň v `primary` i `secondary`, vyplněné `en` všude, kde je vyplněné `cs`;
- svalové skupiny: unikátní `id`, názvy, latinské názvy, pohledy `front`/`back`;
- texty rozhraní: `i18n/cs.json` a `i18n/en.json` mají stejné klíče a stejné proměnné `{…}`;
- schéma svalů: každý sval z `muscles.json` je ve SVG a SVG nemá duplicitní `id`.

Validátor čte vždy aktuální soubory ze serveru (obchází cache service workeru), takže po merge stačí počkat na nasazení a stránku otevřít. Navíc hlídej:

- JSON je platný (jinak validátor ohlásí „neplatný JSON“): řetězce v uvozovkách `"`, mezi objekty čárka, za posledním objektem čárka **není**.
- V `sw.js` je zvýšený `CACHE_VERSION` (viz *Offline režim*).

### Nasazení

GitHub Pages servíruje soubory přímo z větve `main` (kořenový adresář), bez build kroku. Každá změna jde přes samostatnou větev a Pull Request; po sloučení (merge) do `main` je web obvykle do 1–2 minut aktualizovaný.

### Offline režim (PWA)

`manifest.json` popisuje název a ikony, service worker `sw.js` ukládá všechny soubory do cache prohlížeče, takže po prvním načtení aplikace funguje i bez internetu.

- **Při každé změně obsahu nebo kódu zvyš `CACHE_VERSION` v `sw.js`** (např. `1` → `2`). Service worker servíruje soubory z cache; novou verzi prohlížeč pozná jen podle změny `sw.js`. Po nasazení se nová verze stáhne při otevření aplikace a zobrazí se po dalším obnovení stránky (u nainstalované aplikace ji zavři a znovu otevři).
- Přidáš-li nový soubor (JS modul, obrázek…), doplň ho i do seznamu `FILES` v `sw.js`, jinak nebude dostupný offline.
- Ikony v `assets/icons/` generuje skript `python3 tools/generate-icons.py` (vyžaduje Pillow) – ručně je neupravuj. Schéma `assets/body-map.svg` generuje `python3 tools/generate-body-map.py`.

### Testování

- **Po merge** otestuj změnu na <https://pajainzenyr.github.io/hypertrophica/> na PC i na mobilu podle checklistu v popisu PR.
- **Před PR** se změna ověřuje v cloudovém prostředí: lokální server `python3 -m http.server 8000` v kořeni projektu a kontrola v headless prohlížeči (načtení bez chyb, filtry, trénink, záznam sérií, záloha a import, mobilní šířka ~375 px).
- Pokud se změna na webu neprojeví, je to téměř vždy cache service workeru: zkontroluj, že byl zvýšen `CACHE_VERSION`, a stránku obnov dvakrát (nainstalovanou aplikaci zavři a znovu otevři).
- Spuštění z disku (`file://`) nefunguje, protože prohlížeč tak nenačte data přes `fetch` – vždy použij lokální server a otevři `http://localhost:8000`.

## Licence

Kód i data projektu jsou pod licencí [MIT](LICENSE): kdokoli je smí používat, upravovat a šířit, pokud zachová upozornění na autorská práva. Font Barlow Condensed v `assets/fonts/` má vlastní licenci [SIL Open Font License 1.1](assets/fonts/OFL.txt).
