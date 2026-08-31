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

## Non-scope

- 死にコードの削除（`replay-deck` / `md__*` / `mdplayer__*`）。`no-dead-css` の manual に記録し、別作業とする
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
