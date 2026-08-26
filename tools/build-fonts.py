#!/usr/bin/env python3
"""ページで使う文字だけに絞った woff2 を書き出す。

  python3 tools/build-fonts.py

元のTTFは google/fonts から自動で取得してキャッシュする
（tools/.fontsrc/ 。合計16MBあるのでGitには入れない）。

対象文字は index.html から自動で拾い、そこへ「保険」として
かな全種・ASCII・約物を足す。かなは安いので入れておくと、
文言の微修正でグリフが欠ける事故を防げる。
漢字を増やす修正をしたときだけ、流し直しが要る。
"""
import re, sys, html, subprocess, pathlib, os

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC  = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else (ROOT / "tools" / ".fontsrc")
OUT  = ROOT / "assets" / "font"
OUT.mkdir(parents=True, exist_ok=True)

GH = "https://raw.githubusercontent.com/google/fonts/main/ofl"

# (保存名, 出力名, 取得元) — 3書体とも SIL Open Font License 1.1
FONTS = [
    ("ZKGN-500.ttf",      "zkgn-500",      f"{GH}/zenkakugothicnew/ZenKakuGothicNew-Medium.ttf"),
    ("ZKGN-700.ttf",      "zkgn-700",      f"{GH}/zenkakugothicnew/ZenKakuGothicNew-Bold.ttf"),
    ("ZKGN-900.ttf",      "zkgn-900",      f"{GH}/zenkakugothicnew/ZenKakuGothicNew-Black.ttf"),
    ("Mochiy-400.ttf",    "mochiy-400",    f"{GH}/mochiypopone/MochiyPopOne-Regular.ttf"),
    ("Kurenaido-400.ttf", "kurenaido-400", f"{GH}/zenkurenaido/ZenKurenaido-Regular.ttf"),
]


def ensure(path, url):
    """無ければ取ってくる。あるものは触らない。"""
    if path.exists():
        return True
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"  取得中 {path.name} …")
    r = subprocess.run(["curl", "-sfL", "-o", str(path), url])
    if r.returncode != 0:
        print(f"  ★ 取得できない: {url}")
        return False
    return True

def page_chars():
    s = (ROOT / "index.html").read_text(encoding="utf-8")
    s = re.sub(r"<script.*?</script>", "", s, flags=re.S)
    s = re.sub(r"<style.*?</style>",   "", s, flags=re.S)
    s = re.sub(r"<!--.*?-->",          "", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    return set(re.sub(r"\s+", "", html.unescape(s)))

def safety():
    out = set()
    out |= {chr(c) for c in range(0x20, 0x7F)}          # ASCII
    out |= {chr(c) for c in range(0x3041, 0x309F)}      # ひらがな
    out |= {chr(c) for c in range(0x30A0, 0x30FF)}      # カタカナ
    out |= set("　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝〆〇ー―‐／＼～∥｜…‥‘’“”（）〔〕［］｛�}〈〉《》「」『』【】＋－±×÷＝≠＜＞°′″℃￥＄％＃＆＊＠§☆★○●◎◇◆□■△▲▽▼※〒→←↑↓〓")
    return out

chars = page_chars() | safety()
text = "".join(sorted(chars))
print(f"対象 {len(chars)} 字（ページ実測 {len(page_chars())} 字 ＋ 保険）")

subset = os.path.expanduser("~/Library/Python/3.9/bin/pyftsubset")
if not os.path.exists(subset):
    subset = "pyftsubset"

total_before = total_after = 0
for fn, name, url in FONTS:
    src = SRC / fn
    if not ensure(src, url):
        continue
    dst = OUT / f"{name}.woff2"
    subprocess.run([
        subset, str(src), f"--text={text}", f"--output-file={dst}",
        "--flavor=woff2", "--layout-features=", "--no-hinting",
        "--desubroutinize", "--name-IDs=", "--drop-tables+=DSIG",
    ], check=True)
    a, b = src.stat().st_size, dst.stat().st_size
    total_before += a; total_after += b
    print(f"  {name:<16} {a/1024/1024:>6.1f} MB → {b/1024:>6.1f} KB")

print(f"  {'合計':<16} {total_before/1024/1024:>6.1f} MB → {total_after/1024:>6.1f} KB")
