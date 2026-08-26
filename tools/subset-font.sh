#!/bin/sh
# 見出しに使う文字だけを抜き出して woff2 にする。
#
#   sh tools/subset-font.sh <元のフォント.otf|ttf> <出力名>
#   例: sh tools/subset-font.sh ~/Downloads/saien.otf saien
#
# 文字は index.html の <h2> から自動で拾うので、
# 見出しの文言を変えたら必ず流し直すこと。

set -e
SRC="$1"
NAME="${2:-heading}"
[ -f "$SRC" ] || { echo "フォントが見つからない: $SRC"; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$(command -v python3)"
SUBSET="$HOME/Library/Python/3.9/bin/pyftsubset"
[ -x "$SUBSET" ] || SUBSET="$(command -v pyftsubset)"

CHARS=$("$PY" - "$ROOT/index.html" <<'PYEOF'
import re,sys,html
s=open(sys.argv[1],encoding='utf-8').read()
t="".join(re.sub(r'<[^>]+>','',m.group(1)) for m in re.finditer(r'<h2[^>]*>(.*?)</h2>', s, re.S))
t=re.sub(r'\s+','',html.unescape(t))
print("".join(sorted(set(t))))
PYEOF
)

echo "対象 $("$PY" -c "import sys;print(len(sys.argv[1]))" "$CHARS") 字: $CHARS"

mkdir -p "$ROOT/assets/font"
OUT="$ROOT/assets/font/$NAME.woff2"

"$SUBSET" "$SRC" \
  --text="$CHARS" \
  --output-file="$OUT" \
  --flavor=woff2 \
  --layout-features='' \
  --no-hinting \
  --desubroutinize \
  --name-IDs='' \
  --drop-tables+=DSIG

echo "書き出し: $OUT  $(du -h "$OUT" | cut -f1)"
echo "元ファイル: $(du -h "$SRC" | cut -f1)"
