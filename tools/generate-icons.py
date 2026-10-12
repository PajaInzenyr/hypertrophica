#!/usr/bin/env python3
"""Generuje PWA ikony do assets/icons/.

Spuštění (v kořeni projektu): python3 tools/generate-icons.py
Vyžaduje knihovnu Pillow (pip install pillow) – jen pro tento skript, web ji nepotřebuje.

Motiv: bílé „H“ složené jako osa s kotouči na červeném pozadí (barva --accent ze style.css).
Ikony ručně neupravuj – změň tento skript a spusť ho znovu.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ACCENT = "#b3261e"  # --accent ze style.css
FOREGROUND = "#ffffff"

OUT = Path(__file__).resolve().parent.parent / "assets" / "icons"

# Kresba je definovaná na plátně 512×512 px a pro menší ikony se zmenšuje.
# Celá kresba se vejde do kruhu o poloměru 160 px kolem středu, tedy do „bezpečné
# zóny“ maskable ikony (poloměr 40 % šířky), kterou Android nikdy neořízne.
PLATES = [(150, 136, 205, 376), (307, 136, 362, 376)]  # kotouče = svislé čáry písmene H
BAR = (96, 236, 416, 276)  # osa = vodorovná čára písmene H

SUPERSAMPLE = 4  # kreslí se ve 4× větším rozlišení a zmenší se kvůli hladkým hranám


def render(size, rounded):
    """Vrátí ikonu size×size px. rounded=True → zaoblený čtverec s průhlednými rohy."""
    scale = SUPERSAMPLE * size / 512
    big = 512 * scale
    img = Image.new("RGBA", (round(big), round(big)), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    def box(rect):
        return [round(v * scale) for v in rect]

    radius = round(96 * scale) if rounded else 0
    draw.rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=radius, fill=ACCENT)
    draw.rounded_rectangle(box(BAR), radius=round(8 * scale), fill=FOREGROUND)
    for plate in PLATES:
        draw.rounded_rectangle(box(plate), radius=round(14 * scale), fill=FOREGROUND)

    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    icons = {
        "icon-192.png": render(192, rounded=True),
        "icon-512.png": render(512, rounded=True),
        # Maskable: plné pozadí bez průhlednosti, tvar (kruh, kapka…) si určí Android.
        "icon-maskable-512.png": render(512, rounded=False),
        # iOS si rohy zaobluje sám a průhlednost nahrazuje černou → plný čtverec.
        "apple-touch-icon.png": render(180, rounded=False).convert("RGB"),
    }
    for name, img in icons.items():
        img.save(OUT / name, optimize=True)
        print(f"{OUT / name}")


if __name__ == "__main__":
    main()
