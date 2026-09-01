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
- [x] 起点解決そのもののテスト（`harness-git.test.mjs`）
- [x] 実際にコミットして pre-commit の発火を確認
- [x] symlink が全て解決すること（`find -type l` で dead link ゼロ）

## Result

共通部分（エンジン、汎用 contracts / scenarios、`_examples/`、`harness/README.md`）を
`Job/LP/` の1部に集約し、Y2K からは symlink 8本で参照する形にした。Y2K に実ファイルと
して残るのは `asobibar-lp.yaml` の2本だけになった。

**エンジンの起点解決を直す必要があった。** 元は自分のファイル位置から3つ上を無条件に
起点にしていた。Node は `import.meta.url` で symlink を解決するため、共有後はそれが
`Job/LP/` を指し、そこは git リポジトリではないので全ての git 呼び出しが落ちた。
`harness-git.mjs` を三段構え（環境変数 → モジュール位置 → cwd から遡って最寄り）に
変更した。**共有元自身も `harness/` を持つため、両者を分ける判別が要る。**

判別を最初「git 管理下にあるか」で作ったが、これは誤りだった。共有元をバージョン
管理下に置いた次の瞬間に条件が反転し、Y2K から叩くと共有元自身を検査対象にする
状態になった。**エラーにはならない。**共有元には固有 contract が無く worktree も
綺麗なので「差分なし・全部pass」として通り、`asobibar-lp-contract` が判定から
丸ごと抜けたことは出力からは分からなかった。`harness/.shared-source` という明示
マーカーに作り直した。

`PROJECT_ROOT` は関数 `projectRoot()` に変えた。import 時に解決していたため、
共有元では import しただけで例外になり、このモジュールを使うテストが書けなかった。

**副作用として、共有元がバージョン管理外になった。** `Job/LP/` は git リポジトリでは
なく、エンジンの実体だけが履歴を持たない状態になっていた。`git init` して 31 ファイルを
コミットした（`528590b`）。各プロジェクトは `.gitignore` で除外。

### 検証の結果

| 検証 | 結果 |
| --- | --- |
| `harness-check.mjs`（ルート / サブディレクトリ / 環境変数指定の3経路） | 3経路とも起動・判定 |
| `node --test scripts/harness/lib/*.test.mjs` | 43 pass / 0 fail（共有元・Y2K の両方から） |
| dead link | 8本中0本 |
| 親を編集したときの伝播 | 反映を確認（確認後に差し戻し済み） |
| pre-commit の実発火 | コミット `2cc22dc` で発火。check → テスト → シナリオまで通過 |
| clone 先での挙動 | **8本すべて dead、エンジンは起動せず**（想定どおり） |
| clone 先での復元手順 | 実地で通した。symlink 0本、ハーネス起動、36 pass |

### 残っている risk

- **`git clone` しただけでは動かない。** これは構成上の帰結であって不具合ではない。
  hook を入れた状態だとコミットも通らなくなる。AGENTS.md に復元手順を書いたが、
  **手順を踏むまでは確実に壊れている**ことは変わらない。
- 復元手順を実行すると symlink が実ファイルに戻った差分が出る。共有構成を維持するなら
  捨てる必要がある。捨て忘れると、そのプロジェクトだけ黙って共有から外れる。
- 共有元にはまだ remote が無い。**別マシンからは取得できない。**
- Y2K 以外に参照元が増えたとき、エンジンを壊すと全部が同時に止まる。
- **`harness/.shared-source` を消すと、静かに壊れる。**どのプロジェクトから叩いても
  共有元自身を検査し、緑で通る。テスト（`harness-git.test.mjs`、7件）で固定したが、
  マーカーそのものが消される事故は防げない。
