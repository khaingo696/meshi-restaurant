#!/usr/bin/env bash
# Znovu vyrobí podmnožiny japonských řezů.
#
# Plné řezy v repu NEJSOU — Shippori Mincho váží 1,3 MB a Yuji Syuku 3,6 MB,
# a web z nich dohromady používá pár desítek znaků. Stáhni je z fontsource:
#   npm pack @fontsource/shippori-mincho
#   npm pack @fontsource/yuji-syuku
# a vytáhni files/<rodina>-japanese-400-normal.woff2.
#
# fontTools umí zapsat woff2 jen s modulem brotli:
#   python3 -m venv .venv && .venv/bin/pip install fonttools brotli
#
# Použití:
#   scripts/build-jp-subset.sh <shippori.woff2> <yuji.woff2>
set -euo pipefail
SHIPPORI="${1:?cesta k plnému shippori-mincho-japanese-400-normal.woff2}"
YUJI="${2:?cesta k plnému yuji-syuku-japanese-400-normal.woff2}"

# Znaky z webu + celá kana + interpunkce. Kana se drží proto, aby šel
# japonský text doplnit bez nového exportu; ASCII jen u Shippori, které
# slouží i jako záloha pro latinku.
python3 - > /tmp/jp-subset-chars.txt <<'PY'
used = "おしてなもり作出匠味家席心手族旬汁波海評間青飯鮨"
kana = "".join(chr(c) for c in range(0x3041, 0x30FF + 1))
punct = "、。・ー「」『』〜！？（）"
latin = "".join(chr(c) for c in range(0x20, 0x7F))
print("".join(sorted(set(used + kana + punct + latin))), end="")
PY

python3 - > /tmp/jp-subset-chars-kanji.txt <<'PY'
used = "おしてなもり作出匠味家席心手族旬汁波海評間青飯鮨"
kana = "".join(chr(c) for c in range(0x3041, 0x30FF + 1))
punct = "、。・ー「」『』〜！？（）"
print("".join(sorted(set(used + kana + punct))), end="")
PY

sub () {   # <zdroj> <seznam znaků> <cíl>
  python3 -m fontTools.subset "$1" \
    --text-file="$2" \
    --flavor=woff2 --layout-features='*' --no-hinting --desubroutinize \
    --output-file="$3"
  ls -lh "$3"
}

sub "$SHIPPORI" /tmp/jp-subset-chars.txt \
  public/fonts/shippori-mincho/files/shippori-mincho-japanese-400-normal.subset.woff2
sub "$YUJI" /tmp/jp-subset-chars-kanji.txt \
  public/fonts/yuji-syuku/files/yuji-syuku-japanese-400-normal.subset.woff2
