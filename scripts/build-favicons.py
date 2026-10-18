#!/usr/bin/env python3
"""
Ikony záložky z firemního loga — logo samo, bez podkladu.

Logo má jedinou plochou barvu #e0c08a. Na bílé liště prohlížeče má kontrast
1,74:1, tedy prakticky zmizí. Ikona proto přebarvuje tvar na tmavší bronz,
který drží na světlé i tmavé liště (4,18:1 / 3,38:1). Logo na webu zůstává
beze změny, mění se jen favicon.

Spuštění:  python3 scripts/build-favicons.py
"""
from PIL import Image

SRC = "public/assets/meshi_logo_hero.png"
INK = (168, 112, 44)      # bronz — čitelný na bílé i tmavé liště


def square(img, pad=0.04, size=512):
    c = img.crop(img.getbbox())
    flat = Image.new("RGBA", c.size, INK + (255,))
    flat.putalpha(c.split()[-1])          # tvar z loga, barva nová
    side = int(max(c.size) * (1 + pad * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(flat, ((side - c.width) // 2, (side - c.height) // 2), flat)
    return canvas.resize((size, size), Image.LANCZOS)


icon = square(Image.open(SRC).convert("RGBA"))

icon.resize((180, 180), Image.LANCZOS).save("public/apple-touch-icon.png", optimize=True)
icon.resize((32, 32), Image.LANCZOS).save("public/favicon-32.png", optimize=True)
icon.save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("hotovo")
