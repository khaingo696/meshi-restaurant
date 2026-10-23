#!/usr/bin/env bash
#
# Pozadí hera: public/assets/background_video.mp4
#
# Zdroj je sestřih detailů jídel, 1920×1080/30, 41 s. Záběry jsou plné
# jemné struktury (mleté maso, kukuřice, pára) a režou se rychle, takže se
# komprimuje draho — proto ta velikost.
#
# Co se měřilo (41 s, 1080p30, x264, bez zvuku — zdroj audio stopu nemá):
#
#   bez denoise   crf 26        13,94 MB
#                 crf 29        10,26 MB
#                 crf 32         7,58 MB   ← už je vidět bloky
#   s denoise     crf 28        10,55 MB   ← tohle se používá
#                 crf 30 (víc)   8,57 MB   ← mleté maso se slévá do vosku
#                 crf 30, 24fps  8,23 MB
#   720p          crf 26         6,72 MB
#
# Denoise je tu hlavní páka, ne bitrate: ubere zrno, které by jinak sežralo
# bity, a na pozadí pod tmavým závojem se to nepozná. Silnější denoise
# (hqdn3d=6:4:8:6) ušetří další 2 MB, ale jídlo pak vypadá voskově — na webu
# restaurace je to špatná výměna, i když je video pod závojem.
#
# Zbylá páka je DÉLKA. 41 s je na smyčku pozadí hodně; sestřih na 12–15 s
# by velikost srazil skoro lineárně. Který úsek nechat je ale rozhodnutí
# o obsahu, ne o kódování, takže to tenhle skript nedělá.
#
# Rozlišení se drží na 1080p: video je vidět i v mezerách mezi textem a
# zároveň je to `interior` dveří (prosvítá papírem šódži pod pochodní).
#
# Použití:  scripts/build-hero-video.sh <zdroj.mp4>
# Výstup:   public/assets/background_video.mp4  (přepíše se; původní verze
#           je v gitu, commit 7330d51)
set -euo pipefail

src=${1:?Použití: scripts/build-hero-video.sh <zdroj.mp4>}
out="$(cd "$(dirname "$0")/.." && pwd)/public/assets/background_video.mp4"

command -v ffmpeg >/dev/null || { echo "chybí ffmpeg (brew install ffmpeg)" >&2; exit 1; }

ffmpeg -nostdin -y -i "$src" \
  -vf "hqdn3d=4:3:6:4.5" \
  -c:v libx264 -crf 28 -preset veryslow -profile:v high -level 4.0 \
  -pix_fmt yuv420p \
  -an \
  -movflags +faststart \
  "$out"

# +faststart je povinný: bez něj leží moov atom na konci souboru a prohlížeč
# musí stáhnout celé video, než pustí první snímek.
bytes=$(stat -f%z "$out" 2>/dev/null || stat -c%s "$out")
awk -v b="$bytes" -v f="$out" 'BEGIN { printf "%s  →  %.2f MB\n", f, b / 1048576 }'
