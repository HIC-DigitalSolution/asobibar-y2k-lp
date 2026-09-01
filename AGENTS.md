# ASOBIBAR Y2K NIGHT LP — agent contract

このファイルが正典です。Codex はこれを直接読み、Claude Code は `CLAUDE.md` から
ここへ来ます。**内容を二重に持たないでください。**片方だけ更新されると、
どちらが古いのか誰にも分からなくなります。

## Project

ASOBIBAR（マッチングバー）の 2026年9月イベント「Y2K NIGHT」の
**1ページのランディングページ**です。素の HTML / CSS / JS のみ。
ビルド工程もフレームワークもありません。GitHub Pages で公開しています。

- `index.html` / `styles.css` / `script.js` の3つが本体
- `assets/` に画像・動画・セルフホストしたフォント
- テストもステージングも無い。**壊れても差分では見えず、公開してから気づく**

## 何が必ず走るか（誰が操作していても）

読む人にしか効かない文章と違い、これらは git hook で実行されます。

```bash
node scripts/harness/harness-check.mjs                       # 差分に対する不変条件
node scripts/harness/harness-run.mjs --stage pre-push --dry-run
node scripts/harness/new-plan.mjs task <slug> --title "..."  # exec-plan / adr / gotcha
```

- `harness/contracts/asobibar-lp.yaml` — **このLP固有の不変条件**（実際に事故った箇所だけ）
- `harness/contracts/workflow.yaml` — 計画と検証記録の作法
- `.githooks/` — clone ごとに1回 `sh scripts/install-hooks.sh`

### 共通部分は、このリポジトリの外にあります

ハーネスは**エンジンと汎用ルールを他プロジェクトと共有**しています。実体は
`../` （`Job/LP/`）に1部だけあり、ここからは symlink で参照しています。

| 参照（symlink） | 実体 |
| --- | --- |
| `scripts/harness/` | `../../scripts/harness` |
| `harness/contracts/{workflow,secrets}.yaml` | `../../../harness/contracts/` |
| `harness/scenarios/{workflow,harness-self-test}.yaml` | `../../../harness/scenarios/` |
| `harness/*/\_examples/`、`harness/README.md` | 同上 |

**このLP固有なのは実ファイルのものだけ**です:
`harness/contracts/asobibar-lp.yaml` と `harness/scenarios/asobibar-lp.yaml`。
LPのルールを足すならこの2つに書いてください。**symlink 側を編集すると、
それを参照している他のプロジェクト全部に効きます。**

**`git clone` しただけでは動きません。** symlink はリポジトリの外を指しているので、
共有元が無い環境では8本すべてが dead link になり、`harness-check.mjs` は
モジュールが見つからず起動しません。hook を入れていれば、その時点で
コミットも通らなくなります。

共有元（`lp-harness`）を先に取得し、その場所を指定して実ファイルに戻してください。
プロジェクト内の相対パスは共有元の相対パスとそのまま一致します:

```sh
SHARED=/path/to/lp-harness          # 共有ハーネス（このマシンでは ../）を置いた場所
for l in $(find . -type l -not -path './tools/*'); do
  rm "$l" && cp -R "$SHARED/${l#./}" "$l"
done
```

戻したあとは `node scripts/harness/harness-check.mjs` が動くことを確認します。
**この状態でコミットすると symlink が実ファイルに戻った差分が乗ります。**
共有構成を維持するなら、その差分は捨ててください。

**作業完了を報告する前に `harness-check.mjs` を走らせてください。**読み取り専用です。

`[manual]` と出る行は、機械が判定できない規則です。**あれが確認事項の本体**で、
飾りではありません。毎回 `manual` と出続けます。

## このプロジェクト固有の作法

**書体は3つだけ。** `var(--font-main)`（角ゴシック）/ `var(--font-display)`（丸ゴシック）/
`var(--font-hand)`（手書き）。セルフホストしたサブセットしか手元にありません。
**見出しや本文に新しい漢字を足したら `python3 tools/build-fonts.py` を流す。**
忘れるとその字だけ別書体に化けます。かな・ASCII・約物は保険で全部入っています。

**`assets/` は全除外方式です。** `.gitignore` が `assets/*` を除外し、必要なものだけ
`!assets/...` で戻しています。**新しい画像を参照したら許可リストに足す。**
忘れると公開サイトでだけ404になり、ローカルでは最後まで気づけません。

**`index.html` のクエリ番号を上げる。** `styles.css?v=N` / `script.js?v=N`。
上げないと閲覧者には旧版が出続けます。HTML自体にはバスターを付けられないので、
**HTMLだけの変更は強制再読み込みでしか確認できません。**

**検証はヘッドショットで。** アプリ内のブラウザペインは `rAF` を回さないため、
スクロール連動が動かず真っ白になります。実機のChromeをヘッドレスで走らせて
確認してください（`scripts/harness/` とは別に、その都度用意する）。

## デザインの方向性（変更には合意が要る）

「平成のシールとテープの誌面」。線・影・傾きを足していいのは**写真・シール・マステだけ**。

**却下済み（再提案しない）**: ニューブルータリズム、真っ黒の地、CSSで描いた抽象背景、
巨大タイポの復活、意味の通らない英字、大量のシール、**紫**。

**触らない**: FV、背景、写真、主要コピー、セクション順、固定予約CTA。

## Non-negotiables

- **`scripts/harness/` `harness/scenarios/` `.githooks/` の編集は、hookが入っている
  全端末での任意コード実行と同じです。** シナリオの `run:` は誰にも見せずに実行される
  シェルです。設定ではなく hook としてレビューしてください。
- 秘密情報はリポジトリにもクライアント側コードにも入れません。ブラウザに載ったものは
  公開された時点で公開情報です。
- **`TODO(店舗確認)` を推測で埋めない。** 年齢制限・身分証確認・キャンセル規定は、
  間違えると客とのトラブルになります。店舗の回答が来るまで空欄のままにします。
- **`main` への push は本番公開です。** 自動で走らせないでください。

## Tool-specific setup

共有: `harness/` `scripts/` `.githooks/` `docs/`。
形式が違うため意図的に統一していないもの:

- Claude Code: `.claude/settings.json`（権限・hook）、`.claude/agents/`
- Codex: `.codex/config.toml`、`.codex/agents/*.toml`
