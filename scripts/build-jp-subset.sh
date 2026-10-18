#!/usr/bin/env bash
# Znovu vyrobí podmnožinu japonského řezu z plného Shippori Mincho.
#
# Plný řez v repu NENÍ (1,3 MB kvůli 24 znakům). Stáhni ho z fontsource:
#   npm pack @fontsource/shippori-mincho  →  files/shippori-mincho-japanese-400-normal.woff2
# nebo ho vytáhni z historie gitu (smazán 18. 10. 2026).
#
# fontTools umí zapsat woff2 jen s modulem brotli:
#   python3 -m venv .venv && .venv/bin/pip install fonttools brotli
set -euo pipefail
SRC="${1:?cesta k plnému shippori-mincho-japanese-400-normal.woff2}"
OUT="public/fonts/shippori-mincho/files/shippori-mincho-japanese-400-normal.subset.woff2"

# 24 znaků z webu + celá kana + interpunkce + ASCII jako rezerva.
python3 - > /tmp/jp-subset-chars.txt <<'PY'
used = "おしてなもり作出匠味家席心手族旬汁波海評間青飯鮨"
kana = "".join(chr(c) for c in range(0x3041, 0x30FF + 1))
punct = "、。・ー「」『』〜！？（）"
latin = "".join(chr(c) for c in range(0x20, 0x7F))
print("".join(sorted(set(used + kana + punct + latin))), end="")
PY

python3 -m fontTools.subset "$SRC" \
  --text-file=/tmp/jp-subset-chars.txt \
  --flavor=woff2 --layout-features='*' --no-hinting --desubroutinize \
  --output-file="$OUT"
ls -lh "$OUT"
