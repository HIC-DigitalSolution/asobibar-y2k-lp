# GitHub Pagesの公開対象をLP本体に限定する

- **Started:** 2026-09-01
- **Rule:** `docs/exec-plans/README.md` の構造変更ルール
- **Completed path:** `docs/exec-plans/completed/pages-artifact-filter.md`

## Goal

共有ハーネスの構造を維持したまま、GitHub PagesへLP公開ファイルだけを
アップロードし、最新の `main` が公開URLへ反映される状態にする。

## Scope

- [x] Pages専用ワークフローを追加する
- [x] `index.html`、`styles.css`、`script.js`、`assets`だけを成果物にする
- [x] 最新コミットをデプロイし、公開HTMLをローカルと照合する

## Non-scope

- LP本体のデザイン・コピー・モーション変更
- 共有ハーネスのシンボリックリンク構造変更

## Constraints

- 公開成果物にリポジトリ外を指すシンボリックリンクを含めない
- GitHub Pagesの権限は最小限（contents read / pages write / id-token write）にする
- 既存の公開URLを変更しない

## Acceptance

- [x] GitHub ActionsのPagesワークフローが成功する
- [x] 公開HTMLが最新 `main` のHTMLと一致する
- [x] 公開ページでJSエラー・読み込み失敗が発生しない

## Verification

- [x] `node scripts/harness/harness-check.mjs`
- [x] `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/pages.yml"); puts "yaml: ok"'`
- [x] 一時公開ディレクトリにLP本体以外とシンボリックリンクが入らないこと
- [x] GitHub Actions実行結果がsuccessになること
- [x] 公開HTMLとGitHub `main` のSHA-256が一致すること

## Result

`.github/workflows/pages.yml` を追加し、LP本体だけを `_site` へ集約して
`actions/upload-pages-artifact` へ渡すようにした。ローカルの模擬成果物は
70MBで、直下は `.nojekyll`、`assets`、`index.html`、`script.js`、
`styles.css` のみ、シンボリックリンクは0件だった。

`node scripts/harness/harness-check.mjs` は全機械検証を通過し、YAML解析と
`git diff --check`、`node --check script.js` も成功した。GitHub Actions
実行 `33487083373` はsuccess。公開HTML、GitHub Raw、ローカルHTMLの
SHA-256はすべて
`d900f3b02abd683ec7085ff22396153c7e848650653fbacf210a8dc3b28edff1`
で一致した。公開URLの直接検査はSP 390x780、PC 1440x900の両方でHTTP 200、
JSエラー0、読み込み失敗0だった。

従来のブランチ由来Pagesワークフローは共有ハーネスのリンクを含むため
failureのままだが、専用ワークフローが公開を担当し、公開URLは最新化済み。
