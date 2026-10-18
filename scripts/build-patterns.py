#!/usr/bin/env python3
"""
Generuje tradicni japonske vzory (wagara) do public/assets/art/.

Vzory nekreslime od ruky — jsou to presne geometricke konstrukce, takze se
daji spocitat. Kazdy vraci dlazdici, ktera navazuje bez svaru: pocitame i
prvky ze sousednich poli, aby nic nekoncilo na hrane.

  seigaiha  青海波  vlny modreho more  — trvale stesti, klid
  kikko     亀甲    zelvi krunyr       — dlouhovekost
  asanoha   麻の葉  konopny list       — rust a sila
  shippo    七宝    sedm pokladu       — harmonie, dobry osud

MERITKO JE ZASADNI. Stejny vzor je v malem rusivy a ve velkem je to jen
textura. Na pozadi sekce chce velke R a svetly tah; sel jsem na to poprve
s R=48 v liste prekryvu a bylo to prilis husté.
"""
import math
import os

OUT = "public/assets/art"
BG = "#f6f1e7"     # --surface
ST = "#e0cfb2"     # svetlejsi nez --line, aby to byla textura a ne mriz


def _svg(w, h, body, bg=BG):
    """bg=None -> pruhledna dlazdice, da se polozit pres cokoli.
       Seigaiha ho mit musi: vejir vznika tim, ze spodni rada prekryje horni."""
    fill = (f'<rect width="{w:.3f}" height="{h:.3f}" fill="{bg}"/>') if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.3f}" height="{h:.3f}" '
            f'viewBox="0 0 {w:.3f} {h:.3f}">' + fill + body + "</svg>")


def _hex_pts(cx, cy, R):
    """Vrcholy sestiuhelniku spickou nahoru."""
    return [(cx + R * math.sin(math.radians(60 * k)),
             cy - R * math.cos(math.radians(60 * k))) for k in range(6)]


def seigaiha(R=64, rings=3, bg=BG,
             tones=("#efe5d2", "#e8dac1", "#e0cfb2"), hi="#fbf7f0"):
    """Soustredne kruznice; kazda rada posunuta o pul kroku a spodni rady
       prekryvaji horni, takze z kruznice zbyde jen horni vejir.

       Plochy jsou PLNE, ne obtazene. Varianta z pouhych linek se cetla jako
       dratteny model; tri odstiny pres sebe + svetly lem daji tisk na latce."""
    p = []
    for j in range(-3, 5):
        y, off = j * (R / 2), (R / 2) if j % 2 else 0
        for i in range(-3, 5):
            x = i * R + off
            for k in range(rings, 0, -1):
                r = R * k / rings
                p.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" '
                         f'fill="{tones[(rings - k) % len(tones)]}"/>')
                p.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="none" '
                         f'stroke="{hi}" stroke-width=".9"/>')
            p.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{R / rings * 0.42:.1f}" '
                     f'fill="{hi}" opacity=".55"/>')
    return _svg(R, R, "".join(p), bg)


def kikko(R=46, sw=1.3, st=ST, bg=None):
    """Vcelí plast ze sestiuhelniku — z celé ctverice nejklidnejsi."""
    W, H, p = math.sqrt(3) * R, 3 * R, []
    for j in range(-2, 4):
        for i in range(-2, 4):
            cx, cy = i * W + (W / 2 if j % 2 else 0), j * 1.5 * R
            pts = _hex_pts(cx, cy, R)
            p.append('<path d="M' + " L".join(f"{x:.2f},{y:.2f}" for x, y in pts) +
                     f' Z" fill="none" stroke="{st}" stroke-width="{sw}"/>')
    return _svg(W, H, "".join(p), bg)


def asanoha(R=58, sw=1.15, st=ST, bg=None):
    """Sestiuhelnikova mriz + paprsky ze stredu do vrcholu.
       Pri malem R splyne v obycejnou trojuhelnikovou sit — drz R velke."""
    W, H, p = math.sqrt(3) * R, 3 * R, []
    for j in range(-2, 4):
        for i in range(-2, 4):
            cx, cy = i * W + (W / 2 if j % 2 else 0), j * 1.5 * R
            pts = _hex_pts(cx, cy, R)
            p.append('<path d="M' + " L".join(f"{x:.2f},{y:.2f}" for x, y in pts) +
                     f' Z" fill="none" stroke="{st}" stroke-width="{sw}"/>')
            for x, y in pts:
                p.append(f'<line x1="{cx:.2f}" y1="{cy:.2f}" x2="{x:.2f}" y2="{y:.2f}" '
                         f'stroke="{st}" stroke-width="{sw}"/>')
    return _svg(W, H, "".join(p), bg)


def shippo(R=46, sw=1.3, st=ST, bg=None):
    """JEDNA ctvercova mriz s rozestupem R*sqrt(2): kruhy se pretinaji do ctyr
       okvetnich listku a uhlopricne se jen dotykaji. Dve mrize pres sebe
       (muj prvni pokus) vzor zdvojnasobi a tvar se ztrati."""
    s, p = R * math.sqrt(2), []
    for j in range(-2, 4):
        for i in range(-2, 4):
            p.append(f'<circle cx="{i * s:.2f}" cy="{j * s:.2f}" r="{R}" '
                     f'fill="none" stroke="{st}" stroke-width="{sw}"/>')
    return _svg(s, s, "".join(p), bg)


PATTERNS = {"seigaiha": seigaiha, "kikko": kikko, "asanoha": asanoha, "shippo": shippo}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, fn in PATTERNS.items():
        path = os.path.join(OUT, f"{name}.svg")
        with open(path, "w") as f:
            f.write(fn())
        print(f"  {path:38} {os.path.getsize(path):>6} B")
