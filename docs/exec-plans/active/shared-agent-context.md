# Codex / Claude Code 共通コンテキスト整備

- **Started:** 2026-08-31
- **Rule:** [harness/README.md](../../../harness/README.md)
- **Completed path:** `docs/exec-plans/completed/shared-agent-context.md`

## Goal

Codex と Claude Code が、同じ作業ルールだけでなく、現在のLPの状態・決定事項・次の作業まで同じ資料から理解できるようにする。

## Scope

- [ ] `AGENTS.md` に全エージェント共通の読む順番を追加する
- [ ] `docs/PROJECT_CONTEXT.md` に現在地と更新ルールをまとめる
- [ ] `docs/design-docs/project-structure.md` に今後のLP向け推奨構造をまとめる

## Non-scope

- HTML / CSS / JavaScript のデザイン変更
- ハーネス実行コードやgit hookの変更
- 現在のフラットな `assets/` と巨大な `styles.css` の即時移行

## Constraints

- プロジェクト固有情報を `AGENTS.md` と `CLAUDE.md` に二重保存しない
- 会話ログを正典にしない
- 現在の公開構成を壊す大規模なファイル移動は行わない

## Acceptance

- [ ] Codex は `AGENTS.md` から、Claude Code は `CLAUDE.md` 経由で同じ読む順番へ到達できる
- [ ] 現在のセクション構成・固定事項・保留事項が1ファイルで確認できる
- [ ] 次回のLPで使う推奨フォルダ構造と各フォルダの責務が明記される

## Verification

- [ ] `node scripts/harness/harness-check.mjs`
- [ ] `rg` で `CLAUDE.md` が `AGENTS.md` を参照し、`AGENTS.md` が `docs/PROJECT_CONTEXT.md` を参照することを確認
- [ ] 追加文書内に古い作業パス `/Users/rintaro/Job/asb_lp_Y2K` が残っていないことを確認

## Result

作業中。
