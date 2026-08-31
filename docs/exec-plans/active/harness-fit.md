# ハーネスをこのLPに合わせる

- **Started:** 2026-08-31
- **Rule:** [harness/README.md](../../../harness/README.md)
- **Completed path:** `docs/exec-plans/completed/harness-fit.md`

## Goal

汎用テンプレートのまま置かれていたハーネスを、このLP固有の不変条件で動くようにする。
Codex と Claude Code が同じ1つの契約（AGENTS.md）を読み、同じ git hook に縛られる状態にする。

## Scope

- [x] `harness/contracts/asobibar-lp.yaml` を新設。**実際にこのプロジェクトで事故った箇所だけ**を書く
- [x] `harness/scenarios/asobibar-lp.yaml` を新設。1箇所直して公開するまでの順番
- [x] `AGENTS.md` のテンプレート（`{{PROJECT}}` 等）を実内容で埋める
- [x] ハーネスが検出した既存の違反を潰す
- [x] 死にコードの削除（568ルール / 10,163行 → 7,136行）
- [x] `_backup-*` 12個の削除（1.6MB）
- [x] 検証ハーネスを `tools/verify/` へ移設（スクラッチパッドだと毎回消える）

## Non-scope

- CSSのファイル分割。試みたが1文字ずれて表示が崩れたため差し戻した（下記 Result 参照）
- `.codex/` の新設。現状 Codex は AGENTS.md を直接読めているため不要
- ハーネス本体（`scripts/harness/`）の変更

## Constraints

- YAMLパーサは組み込み限定のサブセット。**ブロックスカラー（`>-` `|`）は使えない**
- 想像上のリスクは書かない。誰も直さない規則は、あるだけで信頼を削る
- 機械判定できないものは `type: manual`。`pass` を偽らない

## Acceptance

- [x] `harness-check.mjs` が asobibar-lp-contract で fail 0
- [x] `AGENTS.md` に `{{` のプレースホルダが残っていない
- [x] `CLAUDE.md` は AGENTS.md を指すだけで、固有知識を二重に持たない

## Verification

- [x] `node scripts/harness/harness-check.mjs`
- [x] `node --test scripts/harness/lib/*.test.mjs`（ハーネス自身のテスト）
- [x] `node --check script.js` と CSS の括弧数（本体を壊していないこと）
- [x] PC(1440) / SP(390) のヘッドレス撮影で表示が変わっていないこと

## Result

**ハーネスは新設時点で実在の欠陥を3件検出した。**規則が働いている証拠として記録する。

| 検出 | 内容 | 対応 |
|---|---|---|
| `no-violet` | `styles.css` に `#281541`（FVの地色）が2箇所 | `#0e0b0d` へ。画像が全幅で覆うため表示は不変 |
| `image-budget` | `hero-collage-typography-no-disc.jpg` が735KB | FVのコラージュは全画面に敷く1枚で、落とすと文字が潰れる。**理由付きで例外に登録** |
| `exec-plan-required` | 構造変更に計画書が無い | この文書 |

**機械判定を諦めた規則が1つある。** `new-asset-must-be-unignored` は
`companion-required` で書いたが、**差分からは「追加」と「変更」を区別できず**、
既存画像を差し替えただけで fail する。恒常的に落ちる規則は無視されるようになるので、
`manual` に落とし、代わりに検証コマンドを note に書いた。

**未検証のまま残っている点。** git hook は `sh scripts/install-hooks.sh` を
実行した端末でしか動かない。**この端末で hook が入っているかは未確認**で、
入っていなければ `harness-check` は手で走らせる運用になる。

### 追記: 死にコード削除（①）

HTMLにもJSにも出てこないクラス109種を対象に、**568ルールを削除**した。
10,163行 → 7,136行、251KB → 176KB。

**2回失敗してから通した。**記録しておく。

1. **1回目**: セレクタをカンマで単純分割したため `:is(img, video)` が
   `:is(img` と `video)` に割れ、90%超の画素が変化。全面崩壊。
2. **2回目**: 括弧を数えて分割したが、**プレリュードのコメント内の文字列を
   クラス名として拾い**、生きているルールを巻き添えにした。写真の角丸が消えた。
3. **3回目**: コメントを除去してから判定し、**部分削除をやめて
   「全枝が死んでいる場合のみ丸ごと削除」**に絞って通過。

検証はピクセル比較で行った。`tools/verify/sweep.mjs` で削除前に22枚撮り、
削除後と `compare.py` で突き合わせ。**レイアウトは完全一致**
（docH 7176、全セクションの開始位置が1pxも動かず）。
残った差分は動画のフレーム違いのみ。

### 追記: CSS分割（③）は差し戻した

`styles.css` を foundation / refinements の2枚に割ったが、
**連結が元と1文字ずれ**（179,811 vs 179,812）、表示も最大33%変化した。
分割点が行境界と改行の扱いでずれたため。

**この規模の追記型CSSを機械的に割るのは、専用の作業として時間を取るべき**で、
他の作業のついでにやると壊す。`no-dead-css` と同様、manual の課題として残す。
