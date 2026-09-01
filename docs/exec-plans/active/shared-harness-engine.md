# 共通ハーネスを親に集約し、Y2Kから参照する

- **Started:** 2026-09-01
- **Rule:** [docs/exec-plans/README.md](../README.md)
- **Completed path:** `docs/exec-plans/completed/shared-harness-engine.md`

## Goal

ハーネスの共通部分（エンジンと汎用の contracts / scenarios）を `Job/LP/` に1部だけ置き、
Y2K からは symlink で参照する。エンジンを直せば、それを参照する全プロジェクトに伝播する。
Y2K に残るのは、このLP固有の不変条件だけになる。

## Scope

- [x] `scripts/harness/` を `../../scripts/harness` への symlink に置き換える
- [x] 汎用 contracts（`workflow.yaml` / `secrets.yaml`）を親への symlink に置き換える
- [x] 汎用 scenarios（`workflow.yaml` / `harness-self-test.yaml`）と `_examples/` も同様
- [x] `harness/README.md` を親への symlink に置き換える
- [x] エンジンの起点解決を symlink 対応にする（`scripts/harness/lib/harness-git.mjs`）
- [x] `template/.githooks/` を Y2K に入れ、`install-hooks.sh` で有効化する

## Non-scope

- `docs/*/_template.md` の共通化。テンプレートはプロジェクトごとに手を入れる可能性が高く、
  ハーネスの実行系ではないため今回は触らない。
- `LP/template/` と `LP/` 直下の重複解消。`template/` は新規プロジェクトの種であり、
  `LP/` 直下は共有の実行系という別々の役割になったため、重複のまま残す。
- 他プロジェクトへの展開。Y2K だけを対象にする。

## Constraints

- **Y2K は GitHub にある実リポジトリで、Vercel が公開している。** symlink は git に
  記録され、リポジトリ外を指す。**clone しただけの環境では解決できない。**
- 親 `Job/LP/` は git リポジトリではない。バージョン管理の外にある。
- `scripts/harness/` の編集は、hook が入った全端末での任意コード実行に等しい。

## Acceptance

- [x] Y2K のルート・サブディレクトリ・環境変数指定の3経路で `harness-check.mjs` が動く
- [x] 共通ファイルを親側で1回直すと、Y2K 側の参照に反映される
- [x] `pre-commit` / `pre-push` が実際に発火する
- [x] Y2K 固有の不変条件（`asobibar-lp.yaml`）は実ファイルのまま残る

## Verification

- [x] `node scripts/harness/harness-check.mjs`
- [x] `node scripts/harness/harness-run.mjs --stage pre-push --dry-run`
- [x] `node --test scripts/harness/lib/*.test.mjs`
- [x] 実際にコミットして pre-commit の発火を確認
- [x] symlink が全て解決すること（`find -type l` で dead link ゼロ）

## Result

[完了時に記入]
