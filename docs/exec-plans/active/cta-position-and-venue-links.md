# FVのCTA位置・小文字削除・店舗からLINEへの導線

- **Started:** 2026-11-17
- **Rule:** [docs/design-docs/lp-cvr-knowledge.md](../../design-docs/lp-cvr-knowledge.md)
- **Completed path:** `docs/exec-plans/completed/cta-position-and-venue-links.md`

## 依頼内容（2026-11-17・3件）

1. 「FVのCTAの位置が気になります。もう少し下に。あと30px下にして欲しい」
   → さらに「あともう20px」→ さらに「もう30px」（合計80px）
2. 「CTAの中の席数限定の文字消してください」
3. 「開催店舗の箇所から各店のLINE予約に行けるような導線の仕組みにしましょう」

## Goal

FVのCTAが可能な限り下にあり、**どの画面でも画面外に出ない。**
CTAの中は「LINE予約はこちら」の1行だけ。
**05「開催店舗」の店名から、各店の公式LINEへ直接飛べる。**

## Scope

- [x] `.cover__info` の `top` を `72%` → `72% + 80px`（`min()` の下限は維持）
- [x] CTA 3か所から `<small>席数限定</small>` を削除
- [x] 店名9件を `data-line` 付きのリンクにする
- [x] `script.js` の `data-line` 差し替えをダイアログの外へ出す
- [x] 「予約方法」の行を新しい仕組みの説明に差し替え
- [x] `styles.css?v=491` / `script.js?v=77`

## Non-scope

- **LINE の URL は作らない。**ダイアログの `storeline` にある値をそのまま使う。
- ダイアログ（`.storepick`）は残す。CTAから開く導線は従来どおり。
- 07の節見出し「予約 / RESERVE」はそのまま。

## Constraints

- **CTAを下げすぎない。**`AGENTS.md`: `100svh - 150px` の 150px は
  66px（上部バー）＋70px（CTA）＋逃げ14px。**130px で 1280×720 が 6px はみ出した実績。**
  `min()` の右側は絶対に外さない。
- **`target="_blank"` を付けない。**ダイアログ側と同じ理由
  （Instagram / LINE のアプリ内ブラウザが `_blank` を黙って落とす）。
- **`data-line` の差し替えは https のときだけ。**`javascript:` を踏まないため。
- 押せる高さは 44px を確保する。

## Acceptance

- [x] 10サイズでCTAのはみ出し0
- [x] CTAの文字が「LINE予約はこちら」だけ
- [x] 店名リンク9件が、ダイアログの9件と同じURLに解決する
- [x] 店名リンクに `target="_blank"` が無い
- [x] 押せる高さ44px以上
- [x] JS・コンソールエラー0件

## Verification

- [x] `node scripts/harness/harness-check.mjs`
- [x] `node --check script.js`
- [x] `python3 tools/build-fonts.py`
- [x] ヘッドレスChromeで10サイズの実測
- [x] PC・SPのスクリーンショット目視

## Result

**実装済み（2026-11-17）。** `styles.css?v=491` / `script.js?v=77`。

### CTAの位置 — **限界に当たった**

依頼は合計80pxだが、**実際に下がったのはサイズによる。**

```
サイズ        前    後    移動   画面下までの余り
1440x900     757   816   +59    14px
1920x1080    988   996   + 8    14px
2560x1440   1295  1356   +61    14px
1280x720     636   636     0    14px   ← 元から下限
1512x850       -   766     -    14px
1440x750       -   666     -    14px
```

**主要なPCサイズはすべて「画面下から14px」で止まっている。**これが物理的な下限で、
`66px(バー) + top + 70px(CTA) ≤ 100svh` から来ている。
これ以上下げるには逃げの14pxを削るしかなく、CTAの下端が画面の縁に接する。
**依頼者にはその旨を伝えて判断待ち。**

### CTAの小文字

3か所とも削除。**`min-height: 70px` が効いているのでCTAの高さは70pxのまま**で、
位置計算（150px）は変更不要だった。文字が1行になり中央に座る。

### 店舗からLINEへ

**URLは9店で6本しかない。**関西3店が `lin.ee/ovqzUJi`、名古屋2店が `lin.ee/wc06IWtq`
を共有している。**推測で店ごとに作らないこと。**

**`script.js` の差し替えをダイアログの外へ出した。**元は storepick の IIFE 内で
`dialog.querySelectorAll` していたので店名リンクに効かず、**さらにあの IIFE は
`showModal` が無い環境で早期 return するため、その場合は href が公式HPのままだった。**

### 踏んだこと

**印（LINEマーク）を店名の後ろに置いたら、`新宿歌舞伎町タワー前店` だけ2行に折れて
印が1行目の右端に取り残された。**先頭へ移して解決。

**押せる高さが 38〜39px しか無かった。**`min-height: 24px` / `padding: 5px` では足りず、
`min-height: 44px` にして `li` の `gap` を 7px → 0 にし、見た目の間隔を保った。

### 検証

- 店名リンク9件すべて、**ダイアログの9件と同じURLに解決**（機械で照合）
- `target="_blank"` 0件／押せる高さ 44px以上／JSエラー 0件
- PC 5列・SP 2列／320〜2560で横スクロールの増加なし
- `harness-check` 機械判定すべて pass

### 残っていること

- **CTAをこれ以上下げるには逃げ14pxを削る。**依頼者の判断待ち。
- **未公開。**
