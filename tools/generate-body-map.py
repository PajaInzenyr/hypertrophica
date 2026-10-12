#!/usr/bin/env python3
"""Generátor schématu svalů assets/body-map.svg.

Pomocný nástroj pro vývoj – web ho nepotřebuje, servíruje se jen výsledné SVG.
Spuštění (z kořene repozitáře):  python3 tools/generate-body-map.py

Jak to funguje:
- Každá postava (zepředu, zezadu) má šířku 200 jednotek, střed těla je x = 100.
- Tvary se definují jako body (x, y) jen pro LEVOU polovinu (z pohledu diváka);
  pravá polovina vznikne zrcadlením podle osy x = 100.
- Body se spojí hladkou křivkou (Catmull-Rom → Bézier), takže stačí pár bodů.
- Párové svaly dostanou id <sval>-l / <sval>-r, nepárové id = ID svalu.
  Všechny klikatelné tvary mají class="muscle" a data-muscle = ID z muscles.json.
"""

from pathlib import Path

WIDTH = 200          # šířka jedné postavy
GAP = 16             # mezera mezi postavami
HEIGHT = 440
CENTER = WIDTH / 2
TENSION = 0.85       # 1 = plně zaoblené, menší = ostřejší rohy


# ===== Postava (šířka podle výšky) =====
# Všechny tvary se po definici rozšíří od středu těla. Dvojice (y, koeficient):
# 1.0 = beze změny, 1.15 = o 15 % širší. Mezi body se hodnota plynule mění.
# Širší ramena a hrudník + užší pas = atletický tvar V.
BUILD = [
    (0, 1.00),     # hlava
    (50, 1.18),    # krk a trapézy
    (75, 1.15),    # ramena
    (110, 1.13),   # hrudník, paže
    (150, 1.08),
    (185, 1.03),   # pas
    (215, 1.06),   # boky
    (270, 1.10),   # stehna
    (330, 1.05),   # kolena
    (370, 1.08),   # lýtka
    (440, 1.02),   # chodidla
]


def build_factor(y):
    for (y0, f0), (y1, f1) in zip(BUILD, BUILD[1:]):
        if y0 <= y <= y1:
            return f0 + (f1 - f0) * (y - y0) / (y1 - y0)
    return BUILD[-1][1]


def widen(points):
    return [(CENTER + (x - CENTER) * build_factor(y), y) for x, y in points]


def mirror(points):
    return [(2 * CENTER - x, y) for x, y in reversed(points)]


def fmt(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def smooth_closed(points):
    """Uzavřená hladká křivka procházející všemi body."""
    points = widen(points)
    n = len(points)
    d = f"M{fmt(points[0][0])} {fmt(points[0][1])}"
    for i in range(n):
        p0, p1 = points[i - 1], points[i]
        p2, p3 = points[(i + 1) % n], points[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6 * TENSION, p1[1] + (p2[1] - p0[1]) / 6 * TENSION)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6 * TENSION, p2[1] - (p3[1] - p1[1]) / 6 * TENSION)
        d += f" C{fmt(c1[0])} {fmt(c1[1])} {fmt(c2[0])} {fmt(c2[1])} {fmt(p2[0])} {fmt(p2[1])}"
    return d + "Z"


def symmetric(half):
    """Levá polovina tvaru od středu nahoře po střed dole → celý tvar."""
    right = [p for p in mirror(half) if p[0] != CENTER]
    return half + right


def rounded_rect(x, y, w, h, r):
    # Obdélník se rozšíří stejně jako ostatní tvary (podle svého středu na výšku).
    left, right = (CENTER + (v - CENTER) * build_factor(y + h / 2) for v in (x, x + w))
    x, w = left, right - left
    return (f"M{fmt(x + r)} {fmt(y)}H{fmt(x + w - r)}Q{fmt(x + w)} {fmt(y)} {fmt(x + w)} {fmt(y + r)}"
            f"V{fmt(y + h - r)}Q{fmt(x + w)} {fmt(y + h)} {fmt(x + w - r)} {fmt(y + h)}"
            f"H{fmt(x + r)}Q{fmt(x)} {fmt(y + h)} {fmt(x)} {fmt(y + h - r)}"
            f"V{fmt(y + r)}Q{fmt(x)} {fmt(y)} {fmt(x + r)} {fmt(y)}Z")


# ===== Obrys těla (levá polovina, od krku dolů po rozkrok) =====
SILHOUETTE_HALF = [
    (100, 46), (90, 48), (89, 57), (80, 62), (62, 69), (49, 76), (41, 88), (38, 104),
    (37, 124), (38, 142), (36, 158), (32, 176), (30, 198), (29, 216), (27, 232),
    (29, 248), (37, 252), (42, 238), (44, 222), (48, 200), (53, 180), (57, 162),
    (61, 146), (64, 128), (66, 112), (67, 140), (71, 178), (68, 210), (63, 236),
    (60, 270), (62, 300), (66, 320), (63, 342), (60, 362), (63, 382), (67, 404), (62, 420), (66, 430), (90, 430), (89, 416), (88, 402), (88, 370),
    (92, 342), (94, 322), (96, 288), (100, 238),
]

# ===== Svaly – pohled zepředu =====
FRONT = [
    # (ID svalu, body levé poloviny, párový?)
    ("quads",       [(73, 220), (64, 246), (61, 276), (65, 308), (78, 322), (88, 319), (92, 302), (90, 272), (86, 246), (81, 226)], True),
    ("adductors",   [(89, 236), (98, 244), (98, 264), (95, 286), (93, 298), (91, 272), (88, 252)], True),
    ("calves",      [(70, 342), (63, 360), (64, 382), (70, 398), (78, 397), (85, 378), (88, 356), (84, 342)], True),
    ("obliques",    [(84, 124), (71, 118), (68, 142), (72, 170), (76, 194), (84, 206), (86, 180), (86, 150)], True),
    ("chest",       [(99, 76), (83, 76), (73, 80), (69, 92), (71, 106), (79, 117), (90, 120), (99, 116)], True),
    ("side_delts",  [(58, 70), (47, 75), (40, 87), (38, 101), (41, 112), (48, 105), (49, 91), (53, 78)], True),
    ("front_delts", [(62, 71), (70, 77), (69, 90), (62, 103), (53, 111), (52, 103), (54, 90), (58, 79)], True),
    ("biceps",      [(59, 112), (48, 114), (41, 128), (42, 146), (49, 155), (57, 148), (62, 130)], True),
    ("forearms",    [(54, 162), (41, 165), (34, 180), (32, 206), (36, 216), (44, 212), (49, 192), (56, 172)], True),
]

# ===== Svaly – pohled zezadu =====
BACK = [
    ("hamstrings",  [(70, 262), (62, 284), (64, 310), (72, 324), (82, 326), (92, 314), (96, 290), (94, 266), (85, 261)], True),
    ("calves",      [(70, 340), (62, 358), (63, 378), (71, 394), (79, 386), (85, 366), (88, 350), (82, 340)], True),
    ("glutes",      [(98, 218), (85, 214), (73, 222), (67, 238), (72, 254), (86, 260), (98, 252)], True),
    ("abductors",   [(75, 196), (69, 205), (67, 220), (75, 215), (86, 209), (92, 204), (84, 196)], True),
    ("lats",        [(70, 108), (66, 120), (67, 142), (72, 166), (80, 182), (88, 186), (90, 166), (92, 148), (86, 134), (76, 124)], True),
    ("lower_back",  [(97, 150), (93, 158), (91, 180), (92, 204), (99, 208), (99, 170)], True),
    ("upper_back",  [(93, 100), (88, 90), (76, 85), (70, 92), (71, 105), (79, 118), (91, 128), (95, 116)], True),
    ("traps",       [(100, 50), (93, 54), (84, 61), (68, 70), (64, 77), (76, 80), (88, 86), (95, 96), (97, 112), (98, 140), (100, 152)], False),
    ("rear_delts",  [(62, 70), (48, 76), (40, 90), (40, 107), (52, 102), (63, 90), (69, 79)], True),
    ("triceps",     [(59, 106), (48, 107), (40, 120), (39, 142), (44, 155), (54, 151), (60, 130)], True),
]


def abs_path():
    """Břišní svaly: šest „kostek“ + spodní část, jako jeden tvar."""
    parts = []
    for row, (y, h) in enumerate([(122, 23), (148, 22), (173, 22)]):
        parts.append(rounded_rect(87, y, 12, h, 5))
        parts.append(rounded_rect(101, y, 12, h, 5))
    parts.append(smooth_closed([(88, 198), (99, 198), (99, 222), (93, 214)]))
    parts.append(smooth_closed([(101, 198), (112, 198), (107, 214), (101, 222)]))
    return " ".join(parts)


def muscle(el_id, muscle_id, d):
    return f'    <path id="{el_id}" class="muscle" data-muscle="{muscle_id}" d="{d}"/>'


def figure(view, muscles, offset, extra=()):
    lines = [f'  <g class="view view-{view}" data-view="{view}" transform="translate({offset} 0)">']
    lines.append(f'    <path class="body" d="{smooth_closed(symmetric(SILHOUETTE_HALF))}"/>')
    lines.append('    <ellipse class="body" cx="100" cy="28" rx="17" ry="21"/>')
    lines.extend(extra)
    # Lýtka jsou na obou pohledech – id musí být v celém SVG unikátní.
    suffix = "-back" if view == "back" else ""
    for muscle_id, half, paired in muscles:
        if paired:
            lines.append(muscle(f"{muscle_id}{suffix if muscle_id == 'calves' else ''}-l", muscle_id, smooth_closed(half)))
            lines.append(muscle(f"{muscle_id}{suffix if muscle_id == 'calves' else ''}-r", muscle_id, smooth_closed(mirror(half))))
        else:
            lines.append(muscle(muscle_id, muscle_id, smooth_closed(symmetric(half))))
    lines.append("  </g>")
    return lines


def main():
    total_width = 2 * WIDTH + GAP
    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!-- Hypertrophica – schéma svalů. Vygenerováno skriptem tools/generate-body-map.py, ručně neupravovat. -->",
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_width} {HEIGHT}" class="body-map-svg">',
    ]
    out += figure("front", FRONT, 0, [muscle("abs", "abs", abs_path())])
    out += figure("back", BACK, WIDTH + GAP)
    out.append("</svg>")
    target = Path(__file__).resolve().parent.parent / "assets" / "body-map.svg"
    target.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"Zapsáno: {target}")


if __name__ == "__main__":
    main()
