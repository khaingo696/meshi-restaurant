#!/usr/bin/env python3
"""
Prevod fotek jidel z restaurant_images/dishes/ do public/assets/menu/.

Zdrojove fotky maji ~7000 px a 500 MB celkem, na web jdou jako WebP:
  covers/<slug>.webp      900x1125   (4:5 karta kategorie)
  covers/<slug>@2x.webp  1800x2250
  <cat>/<slug>.webp       800x600    (4:3 dlazdice v prehledu)
  <cat>/<slug>@2x.webp   1600x1200   (slouzi i lightboxu)

Orez je centrovany, u nekolika fotek posunuty pres FOCUS.
"""
import json
import os
import unicodedata
import re
import sys
from PIL import Image

SRC = "restaurant_images/dishes"
OUT = "public/assets/menu"

# Nazev slozky -> (slug, cesky nazev). Klice jsou .strip()-nute, jedna slozka
# ma ve zdroji mezeru na zacatku.
CATS = [
    ("Předkrm",     "predkrmy", "Předkrmy"),
    ("Hlavní chod", "hlavni",   "Hlavní jídla"),
    ("Sushi",       "sushi",    "Sushi"),
]

# Soubor "Anh To" (vietnamsky "velka fotka") je v kazde slozce uvodni fotka.
COVER_RE = re.compile(r"^anh\s*to$", re.I)

# Rucni opravy jmen, kde se zdrojovy soubor zjevne plete.
RENAME = {
    "chickin teriyaki": "Chicken Teriyaki",
}

# Posun orezu tam, kde neni motiv presne uprostred. (x, y) v rozsahu 0..1.
FOCUS = {
    "covers/hlavni": (0.38, 0.52),
    "covers/predkrmy": (0.44, 0.50),
    "covers/sushi": (0.50, 0.46),
}


def slugify(name):
    s = name.lower()
    s = s.replace("ř", "r").replace("á", "a").replace("í", "i").replace("é", "e")
    s = s.replace("ě", "e").replace("š", "s").replace("č", "c").replace("ž", "z")
    s = s.replace("ý", "y").replace("ú", "u").replace("ů", "u").replace("ň", "n")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def clean_name(stem):
    """'Salmon Teriyaki Salad-2' -> 'Salmon Teriyaki Salad'"""
    s = unicodedata.normalize("NFC", stem).strip()
    s = re.sub(r"[-_]\s*\d+$", "", s)   # variantni cislo fotky
    s = s.rstrip("_- ")
    low = s.lower()
    if low in RENAME:
        return RENAME[low]
    # Title Case jen u souboru psanych cele malymi pismeny
    if s == low:
        s = " ".join(w.capitalize() for w in s.split())
    return s


def render(src_path, dst_path, w, h, focus=(0.5, 0.5)):
    with Image.open(src_path) as im:
        im = im.convert("RGB")
        sw, sh = im.size
        target = w / h
        if sw / sh > target:               # zdroj je sirsi -> orez po stranach
            cw, ch = int(sh * target), sh
        else:                              # zdroj je vyssi -> orez nahore/dole
            cw, ch = sw, int(sw / target)
        left = int((sw - cw) * focus[0])
        top = int((sh - ch) * focus[1])
        im = im.crop((left, top, left + cw, top + ch))
        im = im.resize((w, h), Image.LANCZOS)
        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        im.save(dst_path, "WEBP", quality=82, method=6)
    return os.path.getsize(dst_path)


def main():
    root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(sys.argv[1] if len(sys.argv) > 1 else ".")

    data, total, count = [], 0, 0
    for folder, cslug, clabel in CATS:
        # slozka " Hlavní chod" ma mezeru na zacatku, hledame tolerantne
        # macOS uklada jmena v NFD, porovnavame az po normalizaci na NFC
        match = [d for d in os.listdir(SRC)
                 if unicodedata.normalize("NFC", d).strip() == folder
                 and os.path.isdir(os.path.join(SRC, d))]
        if not match:
            print(f"!! chybi slozka {folder!r}", file=sys.stderr)
            continue
        folder_path = os.path.join(SRC, match[0])

        files = sorted(f for f in os.listdir(folder_path)
                       if f.lower().endswith((".jpg", ".jpeg", ".png")))
        cover, items = None, []

        for fn in files:
            stem = os.path.splitext(fn)[0]
            src = os.path.join(folder_path, fn)

            if COVER_RE.match(stem.strip()):
                key = f"covers/{cslug}"
                total += render(src, f"{OUT}/covers/{cslug}.webp", 900, 1125, FOCUS.get(key, (.5, .5)))
                total += render(src, f"{OUT}/covers/{cslug}@2x.webp", 1800, 2250, FOCUS.get(key, (.5, .5)))
                cover = f"/assets/menu/covers/{cslug}.webp"
                count += 2
                continue

            name = clean_name(stem)
            slug = slugify(name)
            total += render(src, f"{OUT}/{cslug}/{slug}.webp", 800, 600)
            total += render(src, f"{OUT}/{cslug}/{slug}@2x.webp", 1600, 1200)
            count += 2
            items.append({"slug": slug, "name": name, "price": None,
                          "img": f"/assets/menu/{cslug}/{slug}.webp"})
            print(f"  {clabel:<14} {name}")

        data.append({"slug": cslug, "label": clabel, "cover": cover, "items": items})

    with open("/tmp/menu-data.json", "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n{count} souboru, {total/1024/1024:.1f} MB celkem")
    for c in data:
        print(f"  {c['label']}: {len(c['items'])} jidel, cover={'ano' if c['cover'] else 'CHYBI'}")


if __name__ == "__main__":
    main()
