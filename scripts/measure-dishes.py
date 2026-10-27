#!/usr/bin/env python3
"""
Zmeri hlavni talir v kazdem vyrezu z public/assets/dishes/ a zapise
src/data/dish-fit.json pro sekci Signatures.

Vyrezy maji ruzny pomer stran a hlavni talir v nich zabira ruzny kus
(miska s ramenem vs. miska s ryzi vedle). app.js podle techto cisel
nastavi kazdemu jidlu sirku tak, aby HLAVNI talir mel ve vsech jidlech
stejny prumer, a posune ho stredem do kruhu. Prilohy (ryze, sojovka)
smi z kruhu vycuhovat.

  d     prumer talire jako podil sirky obrazku
  x, y  stred talire, podil sirky / vysky (0..1)
  r     vyska / sirka obrazku
  h     konvexni obal jidla (x, y, x, y, ...) vzhledem ke stredu talire,
        v sirkach obrazku — app.js podle nej hlida, kam prilohy vycuhuji,
        a jidlo pripadne pootoci, aby se priloha vesla tam, kde je misto
  g     1 = jidlo z vic nadob (miska + ryze zvlast). Tam neni jeden hlavni
        talir: stred je teziste cele fotky a d je delsi strana jejiho
        obdelniku, app.js pak velikost bere z cele kompozice

Kulaty talir: prumer = nejvetsi vepsany kruh do alfa masky (vzdalenostni
transformace), stred = stred elipsy prolozene okrajem (rim_center) —
vepsany kruh v lehce ovalne misce klouze a stal o pixel dva mimo okraj. U protahlych (deska nigiri, ovalne talire) by vepsany
kruh byl prouzek, tam se bere kruh o stejne plose a stred je teziste.
Vic nadob se pozna samo: alfa maska ma vic nez jeden velky ostruvek.

Pri vymene fotek staci spustit znovu:  python scripts/measure-dishes.py
Potrebuje numpy, opencv-python a Pillow.
"""
import glob
import json
import math
import os

import cv2
import numpy as np
from PIL import Image

SRC = "public/assets/dishes"
OUT = "src/data/dish-fit.json"

# Protahle talire: vepsany kruh nic nerika, meri se plocha.
ELONGATED = {"nigiri", "sake-set", "samuraj-roll", "signature-m-s-foie-gras", "signature-m-s-salmon"}
# Protahly talir pri stejnem "kruhu o stejne plose" pusobi vetsi nez kulaty.
ELONGATED_DAMP = 0.98
# Dlouha uzka deska (nigiri, samuraj roll) s kruhem o stejne plose pusobi
# porad moc velka: jeji delka kruh prerusta. Od pomeru os LONG_FROM se d
# zvetsi (= jidlo zmensi) podle toho, o kolik je deska protahlejsi.
LONG_FROM = 1.5
LONG_DAMP = 0.25
# Ostruvek mensi nez tohle (podil plochy ctverce sirky) je drobek, ne nadoba.
PART_MIN = 0.01
# Stred okraje smi od stredu vepsaneho kruhu ujet nejvys o tohle (podil sirky).
RIM_TRUST = 0.02


def rim_center(contour):
    """Stred obvodu talire tak, jak ho vidi oko: elipsa prolozena obrysem.
    Kazde kolo zahodi petinu bodu nejdal od elipsy (rajce, cibulka nebo
    hulky pres okraj), takze zbude cisty okraj misky."""
    pts = contour[:, 0].astype(np.float32)
    for _ in range(4):
        (ex, ey), (ma, mi), ang = cv2.fitEllipse(pts)
        t = math.radians(ang)
        dx, dy = pts[:, 0] - ex, pts[:, 1] - ey
        u = dx * math.cos(t) + dy * math.sin(t)
        v = -dx * math.sin(t) + dy * math.cos(t)
        err = np.abs(np.sqrt((u / (ma / 2)) ** 2 + (v / (mi / 2)) ** 2) - 1)
        pts = pts[err <= np.quantile(err, 0.8)]
    return ex, ey


def measure(path):
    a = np.asarray(Image.open(path).getchannel("A"))
    h, w = a.shape
    m = (a > 128).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    solid = np.zeros_like(m)
    cv2.drawContours(solid, cs, -1, 1, -1)   # diry uvnitr talire nemeni jeho obrys
    slug = os.path.splitext(os.path.basename(path))[0]
    group = sum(cv2.contourArea(c) > PART_MIN * w * w for c in cs) > 1
    if group:
        ys, xs = np.nonzero(solid)
        d = max(xs.max() - xs.min(), ys.max() - ys.min()) / w
        x, y = xs.mean() / w, ys.mean() / h
    elif slug in ELONGATED:
        d = math.sqrt(4 * solid.sum() / math.pi) / w * ELONGATED_DAMP
        ys, xs = np.nonzero(solid)
        ev = np.linalg.eigvalsh(np.cov(np.vstack([xs, ys])))
        d *= max(1.0, math.sqrt(ev[1] / ev[0]) / LONG_FROM) ** LONG_DAMP
        x, y = xs.mean() / w, ys.mean() / h
    else:
        dt = cv2.distanceTransform(solid, cv2.DIST_L2, 5)
        d = 2 * float(dt.max()) / w
        cy, cx = np.unravel_index(dt.argmax(), dt.shape)
        ex, ey = rim_center(max(cs, key=cv2.contourArea))
        # Obrys, ktery neni jedna miska (u maguro se talire dotyka konvicka),
        # by elipsu odtahl — tam zustava stred vepsaneho kruhu.
        if math.hypot(ex - cx, ey - cy) > RIM_TRUST * w:
            ex, ey = cx, cy
        x, y = ex / w, ey / h
    hull = cv2.convexHull(np.vstack([c[:, 0] for c in cs]))
    hull = cv2.approxPolyDP(hull, w * 0.006, True)[:, 0]   # par desitek bodu staci
    pts = [round(float(v), 3) for px, py in hull for v in ((px - x * w) / w, (py - y * h) / w)]
    out = {"d": round(d, 3), "x": round(float(x), 3), "y": round(float(y), 3), "r": round(h / w, 3), "h": pts}
    if group:
        out["g"] = 1
    return slug, out


def main():
    fit = dict(measure(p) for p in sorted(glob.glob(os.path.join(SRC, "*.webp"))))
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(fit, f, indent=2)
        f.write("\n")
    for slug, v in fit.items():
        print(f"{slug:26} d={v['d']:.3f}  stred=({v['x']:.2f}, {v['y']:.2f})")


if __name__ == "__main__":
    main()
