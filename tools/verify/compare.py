#!/usr/bin/env python3
"""2つの撮影ディレクトリをピクセル比較する。

  python3 tools/verify/compare.py base after

CSSの削除やリファクタで「表示は変えていない」と言うとき、
目視ではなくこれで示す。差分が出た画像だけを名指しする。
"""
import sys, pathlib
from PIL import Image, ImageChops

root = pathlib.Path(__file__).parent / "shots"
a_dir, b_dir = root / (sys.argv[1] if len(sys.argv) > 1 else "base"), root / (sys.argv[2] if len(sys.argv) > 2 else "after")
names = sorted({p.name for p in a_dir.glob("*.png")} | {p.name for p in b_dir.glob("*.png")})
if not names:
    print("撮影が見つからない:", a_dir, b_dir); sys.exit(1)

worst, diffs = 0.0, []
for n in names:
    pa, pb = a_dir / n, b_dir / n
    if not pa.exists() or not pb.exists():
        diffs.append((n, "片方しか無い")); continue
    ia, ib = Image.open(pa).convert("RGB"), Image.open(pb).convert("RGB")
    if ia.size != ib.size:
        diffs.append((n, f"寸法違い {ia.size} vs {ib.size}")); continue
    d = ImageChops.difference(ia, ib)
    px = d.getdata()
    changed = sum(1 for r, g, bl in px if r > 6 or g > 6 or bl > 6)
    pct = changed / (ia.width * ia.height) * 100
    worst = max(worst, pct)
    if pct > 0.05:
        diffs.append((n, f"{pct:.2f}% の画素が変化"))

print(f"比較 {len(names)}枚  最大変化 {worst:.2f}%")
if diffs:
    print("差が出た画像:")
    for n, why in diffs: print(f"  {n}  {why}")
    sys.exit(1)
print("表示は同一（しきい値 0.05%）")
