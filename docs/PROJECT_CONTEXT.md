# ASOBIBAR Y2K NIGHT LP — current context

**Last updated:** 2026-08-31
**Status:** 現在のデザインを維持しながら局所調整中
**Canonical rules:** [`../AGENTS.md`](../AGENTS.md)

このファイルはCodexとClaude Codeが共有する「現在地」です。
会話ログや片方のツールだけのメモより、このファイルを優先します。

## Product goal

ASOBIBARの2026年9月企画「Y2K NIGHT」の1ページLP。
平成初期のシール帳・テープ・写真アルバムを感じるデザインを使い、
懐かしさだけでなく、予約したくなる楽しさまで伝える。

全面リニューアルではなく、既存の背景・写真・コピー・配色・Y2K世界観を維持しながら、
情報階層、余白、写真の見せ方、スクロール体験、マイクロインタラクションを磨く。

## Current page map

| Page | Section | Current role |
|---|---|---|
| P.01 | FV | Y2K世界への入口。文字込みのコラージュ画像と予約CTA |
| P.01 | SONG REQUEST | 写真の下へ紙面を重ね、コピーとSONG PET端末を別レイヤーで見せる |
| P.02 | Experience movie | 店内の賑わいを動画で見せ、コピーを映像内の左下へ置く |
| P.03 | PRICE | 写真上に「100分プラン誕生！」、関西・関東料金は下の紙面へ分離 |
| P.04 | EVENT INFORMATION | 開催期間・対象店舗・予約方法を読ませる |
| — | HOW TO ASOBIBAR | COLOR BAND / AMUSEMENT / FOOD & DRINKの3ステップ |
| P.05 | FINAL CTA | 写真、コピー、予約CTAの順で締める |

## Approved visual direction

- 「平成のシールとテープの誌面」
- 紙、写真、プリクラ、マステ、箔シールを使う
- 線・影・傾きを足してよいのは、原則として写真・シール・マステ
- 本文と主要見出しは `var(--font-main)` を基本にする
- 色はローズ、ピンク、水色、温かい紙色、温かい墨を中心にする
- 写真をカードへ閉じ込めすぎず、重なりと断ち落としで誌面を作る

### Do not bring back

- 紫の地や紫の帯
- 真っ黒な面を長く続ける構成
- ニューブルータリズム
- 巨大な意味不明英字、`THAT SONG.`、旧 `PLAY TOGETHER` 巨大タイポ
- `MINUTES`、DVD / MDモチーフ
- 大量のシール、星、ハート、グリッチ、クローム
- SPだけ別書体にする指定

## Current implementation facts

- 素の `index.html` / `styles.css` / `script.js`。ビルド工程なし
- CSS cache key: `styles.css?v=369`
- JS cache key: `script.js?v=59`
- `main` へのpushはGitHub Pages本番公開
- 予約先が未設定の場合は公式HPへフォールバック
- 公開素材は `.gitignore` の `assets/` 許可リストへ追加が必要
- 見出し・本文に新しい漢字を追加したらフォントサブセットを更新する

## Current interaction direction

- FVは短い導入と弱い常時モーション
- SONG REQUESTは端末操作とスクロール進行を主役にする
- P.02は映像を主役にし、装飾を増やしすぎない
- PRICEは読み取り速度を優先し、数字を明確にする
- EVENTとHOW TOは派手に動かさず、FINALで再び感情を上げる
- SPはparallax量、移動量、pin時間を減らす
- `prefers-reduced-motion` を維持する

## Known open items

- `TODO(店舗確認)`：年齢制限、身分証、キャンセル規定は未確認。推測禁止
- `LINE_RESERVATION_URL`：確定URLが入るまでは公式HPへフォールバック
- `styles.css` に旧部品の死にルールが残る。機械的一括削除は禁止
- FVは文字込みの1枚画像。レイヤー別モーションには元データが必要
- 変更後はPC 1440pxとSP 390pxで目視確認する

## Update rule

以下が変わったときだけ、このファイルを更新します。

- セクションの追加・削除・役割変更
- ユーザーが採用または却下したデザイン方針
- 公開方式、キャッシュ番号、予約URLなどの運用状態
- 次のエージェントが知らないと誤実装する保留事項

px単位の微調整や完了済みの作業ログはここへ残さず、exec-planやgit履歴へ残します。
