# 予約導線を全部伏せる

- **Started:** 2026-11-17
- **Rule:** [docs/design-docs/lp-cvr-knowledge.md](../../design-docs/lp-cvr-knowledge.md)
- **Completed path:** `docs/exec-plans/completed/hide-reserve-ctas.md`

## 依頼内容（2026-11-17）

依頼者が「FVの箇所のCTA消えてない」と指摘。確認の結果、**ボタンごと無くす**という
意図だった。`AskUserQuestion` で範囲を確認し、**「予約導線を全部」**を選択。

**同じスクショの文面「CTAと詳細から、期間を排除」は別件で、すでに完了・公開済み。**
あれは期間の削除であって、CTAの削除ではない。読み違えないこと。

## Goal

**ページのどこからも予約に進めなくなる。**押せる予約ボタンが0個で、
店舗選択ダイアログも開かない。**`hidden` なので属性を外せば元に戻る。**

## Scope

- [x] FVのCTA（`.cover__info`）を伏せる
- [x] 最終CTA（`.cta--final`）と、その直前の `.final-perk` を伏せる
- [x] 固定CTAバー（`.ctabar`）を伏せる
- [x] 店舗選択ダイアログ（`.storepick`）を伏せる

## Non-scope

- **節や文言は消さない。**07 `#reserve` の写真・見出し・リード文は残す。
  ノンブルは 01〜07 のままで、総数も `/P.07` のまま動かさない。
- **`script.js` は触らない。**要素は DOM に残るので `querySelector` は null にならない。
  消すのではなく伏せる理由がここにもある。
- 05の「予約方法 公式HPから予約」、07の節見出し「予約 / RESERVE」、
  フッターナビの「予約」は**文言であって導線ではない**ので今回は残す。
  **ただし矛盾して見えるので、依頼者に判断を仰ぐ**（下記 risk）。

## Constraints

- **消さずに伏せる。**`#price` と同じ考え方（`no-dead-css`）。
- **`[hidden]{display:none!important}` が既にある**（styles.css:77）。
  UAの `[hidden]` は作者スタイルに負けるので、これが無いと属性だけ付いて表示が残る。
- **FVの `.cover__info` は ≥900px で絶対配置。**伏せても他要素は動かないはずだが実測する。
- **`.ctabar` は `script.js` が `is-suppressed` を付け外しする。**
  `!important` 付きの `[hidden]` が勝つことを実測で確かめる。

## Acceptance

- [x] `[data-reserve]` の矩形が0件（押せる予約ボタンが画面に無い）
- [x] `.ctabar` / `.storepick` / `.final-perk` の矩形が0件
- [x] 07 `#reserve` の写真・見出し・リード文は残っている
- [x] ノンブルが 01→01→02→03→04→05→06→07、総数 `/P.07`
- [x] JS・コンソールエラー0件（要素を消していないので null にならない）
- [x] 320/375/390/768/1440 で横スクロールの増加なし

## Verification

- [x] `node scripts/harness/harness-check.mjs`
- [x] ヘッドレスChromeで5幅の実測＋ノンブル読み取り
- [x] FVと07のスクリーンショット目視

## Result

**実装済み（2026-11-17）。** `index.html` のみ。CSSもJSも触っていないので
キャッシュ番号は `styles.css?v=484` / `script.js?v=76` のまま。

### やったこと

`hidden` 属性を4か所に付けただけ。`[hidden]{display:none!important}`（styles.css:77）は
`#price` のときに入れたものがそのまま効いている。

| 伏せたもの | セレクタ |
| --- | --- |
| FVのCTA | `.cover__info` |
| 07の特典表記 | `.final-perk`（「LINE予約で無料フードチケット」） |
| 最終CTA | `.cta--final` |
| 固定CTAバー | `.ctabar` |
| 店舗選択ダイアログ | `.storepick` |

### 判断

**`script.js` は1行も触っていない。** `querySelector(".cover .cta")` /
`.cta--final` / `[data-storepick]` は DOM に残るので null にならない。
**消していたら JS を直す必要が出ていた。**伏せる利点がここにも出た。

**固定バーは `script.js` が `is-suppressed` を付け外しするが、`!important` 付きの
`[hidden]` が勝つ。**最後までスクロールして矩形0を確認済み。

### 検証（5幅とも同じ結果）

```
押せる予約ボタン   0個
FVのCTA / 特典 / 最終CTA / 固定バー / ダイアログ   すべて矩形 0
07に残るもの      「懐かしいだけで終わらない。今夜を、新しい思い出に」
                  「あの頃の曲から始まる、大人のY2Kナイトへ。」＋写真
JS・コンソールエラー 0件
横スクロール       320/375/390/1440 は増加なし。768 は +2px（既知の .tape--y.tape--r1）
```

- `node scripts/harness/harness-check.mjs` 機械判定すべて pass

### 残っていること — **依頼者の判断待ち**

**07の節見出しが「予約 / RESERVE」のまま、フッターナビにも「予約」が残っている。**
押せるものが無いのに「予約」と書いてある状態で、**訪問者には不具合に見える。**
文言は導線ではないので今回は触っていないが、**どちらかは要る**:

- 見出しを「この夜について」等に変え、フッターの「予約」を外す
- または CTA を戻す

**05の「予約方法 公式HPから予約」も同じ。**押す先が無いのに予約方法だけ残っている。

**未公開。** `asb-y2k-event.hic-marketing.com` にはまだ出していない。
