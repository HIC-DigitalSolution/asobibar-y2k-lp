# GitHub Pagesの公開対象をLP本体に限定する

- **Started:** 2026-09-01
- **Rule:** `docs/exec-plans/README.md` の構造変更ルール
- **Completed path:** `docs/exec-plans/completed/pages-artifact-filter.md`

## Goal

共有ハーネスの構造を維持したまま、GitHub PagesへLP公開ファイルだけを
アップロードし、最新の `main` が公開URLへ反映される状態にする。

## Scope

- [ ] Pages専用ワークフローを追加する
- [ ] `index.html`、`styles.css`、`script.js`、`assets`だけを成果物にする
- [ ] 最新コミットをデプロイし、公開HTMLをローカルと照合する

## Non-scope

- LP本体のデザイン・コピー・モーション変更
- 共有ハーネスのシンボリックリンク構造変更

## Constraints

- 公開成果物にリポジトリ外を指すシンボリックリンクを含めない
- GitHub Pagesの権限は最小限（contents read / pages write / id-token write）にする
- 既存の公開URLを変更しない

## Acceptance

- [ ] GitHub ActionsのPagesワークフローが成功する
- [ ] 公開HTMLが最新 `main` のHTMLと一致する
- [ ] 公開ページでJSエラー・読み込み失敗が発生しない

## Verification

- [ ] `node scripts/harness/harness-check.mjs`
- [ ] `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/pages.yml"); puts "yaml: ok"'`
- [ ] 一時公開ディレクトリにLP本体以外とシンボリックリンクが入らないこと
- [ ] GitHub Actions実行結果がsuccessになること
- [ ] 公開HTMLとGitHub `main` のSHA-256が一致すること

## Result

未完了。ワークフローの検証・push・公開確認後に結果を記録する。
