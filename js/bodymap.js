// Klikací schéma svalů (SVG postava zepředu a zezadu).
// SVG se načte ze souboru a vloží přímo do stránky, aby šlo stylovat přes CSS
// a reagovat na kliknutí. Každý sval v SVG má atribut data-muscle = ID svalu.

let svgSource = null;

export async function loadBodyMapSource(url = './assets/body-map.svg') {
  if (svgSource) return svgSource;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  svgSource = await response.text();
  return svgSource;
}

// Vloží schéma do prvku `container`.
//   getLabel(muscleId) → text pro popisek (tooltip, čtečka obrazovky)
//   onSelect(muscleId) → zavolá se po kliknutí na sval; bez něj je schéma jen pro čtení
// Vrací objekt s metodami pro zvýraznění svalů.
export function createBodyMap(container, { getLabel, onSelect } = {}) {
  container.innerHTML = svgSource.replace(/<\?xml[^>]*>/, ''); // XML hlavička do HTML nepatří
  const svg = container.querySelector('svg');
  const shapes = [...svg.querySelectorAll('.muscle')];
  const interactive = typeof onSelect === 'function';

  if (!interactive) {
    // Kopie schématu (např. v detailu cviku) nesmí mít stejná id jako hlavní schéma.
    shapes.forEach((shape) => shape.removeAttribute('id'));
    svg.setAttribute('aria-hidden', 'true');
  } else {
    svg.setAttribute('role', 'group');
    const seen = new Set();
    shapes.forEach((shape) => {
      const id = shape.dataset.muscle;
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = getLabel(id);
      shape.append(title); // tooltip po najetí myší

      // Klávesnicí jde přejít jen na první tvar každého svalu (levý/pravý se nezdvojuje).
      if (!seen.has(id)) {
        seen.add(id);
        shape.setAttribute('tabindex', '0');
        shape.setAttribute('role', 'button');
        shape.setAttribute('aria-label', getLabel(id));
        shape.setAttribute('aria-pressed', 'false');
      }
    });

    // Jeden posluchač pro celé SVG místo jednoho na každý sval.
    svg.addEventListener('click', (event) => {
      const shape = event.target.closest('.muscle');
      if (shape) onSelect(shape.dataset.muscle);
    });
    svg.addEventListener('keydown', (event) => {
      const shape = event.target.closest('.muscle');
      if (shape && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); // mezerník by jinak posunul stránku
        onSelect(shape.dataset.muscle);
      }
    });
  }

  // Najetí myší na jeden sval zvýrazní i jeho protějšek na druhé straně těla.
  // Jen pro myš – na dotykovém displeji by zvýraznění po klepnutí zůstalo viset.
  if (interactive) {
    svg.addEventListener('pointerover', (event) => {
      if (event.pointerType === 'mouse') setHover(event.target.closest('.muscle')?.dataset.muscle);
    });
    svg.addEventListener('pointerleave', () => setHover(null));
  }

  function setHover(muscleId) {
    shapes.forEach((s) => s.classList.toggle('is-hover', s.dataset.muscle === muscleId));
  }

  return {
    // Hlavní schéma: zvýrazní vybraný sval (nebo nic, když je muscleId prázdné).
    setActive(muscleId) {
      shapes.forEach((s) => {
        const active = s.dataset.muscle === muscleId;
        s.classList.toggle('is-active', active);
        if (s.hasAttribute('aria-pressed')) s.setAttribute('aria-pressed', String(active));
      });
    },
    // Detail cviku: primární svaly plnou barvou, sekundární světlejší.
    setEngagement(primary = [], secondary = []) {
      shapes.forEach((s) => {
        s.classList.toggle('is-active', primary.includes(s.dataset.muscle));
        s.classList.toggle('is-secondary', secondary.includes(s.dataset.muscle));
      });
    },
    // Trénink: malý odznak s číslem (počet cviků) na každém zapojeném svalu.
    //   counts = Map(id svalu → počet); sval s počtem 0 nebo bez záznamu odznak nemá.
    // Místo odznaku určují atributy data-label-x/y v SVG (viz tools/generate-body-map.py).
    setCounts(counts) {
      svg.querySelectorAll('.muscle-count').forEach((badge) => badge.remove());
      shapes.filter((s) => s.dataset.labelX).forEach((s) => {
        const count = counts.get(s.dataset.muscle);
        if (!count) return;
        const badge = svgElement('g', { class: 'muscle-count' });
        badge.append(
          svgElement('circle', { cx: s.dataset.labelX, cy: s.dataset.labelY, r: 8 }),
          svgElement('text', { x: s.dataset.labelX, y: s.dataset.labelY })
        );
        badge.lastChild.textContent = String(count);
        s.parentNode.append(badge); // do stejné skupiny (pohledu) jako sval, ať sedí souřadnice
      });
    },
  };
}

// Vytvoří prvek SVG s atributy (SVG prvky potřebují createElementNS, ne createElement).
function svgElement(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
  return node;
}
