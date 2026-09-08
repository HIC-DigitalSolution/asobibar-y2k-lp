# プロジェクトを Job/LP/ の外に移して、フックが黙って止まっていた

- **踏んだ日:** 2026-09-08

## 症状

**エラーは1つも出ませんでした。**それがこの gotcha の全部です。

`git commit` は普段どおり通り、普段どおり何も表示しない。**`pre-commit` が
走っていないときの表示と、通ったときの表示が同じ**なので、画面からは区別がつきません。
この状態で 750ac9b と 53d279b の**2コミットを、検証を1度も通さずに積んでいました。**

気づいたのは、ナレッジを読もうとしたときです。

```
$ cat docs/design-docs/lp-visual-knowledge.md
cat: docs/design-docs/lp-visual-knowledge.md: No such file or directory
```

ファイルは `ls` に出ているのに開けない。リンク切れでした。

```
$ ls -l scripts/harness
scripts/harness -> ../../scripts/harness      # 実体なし
```

同じ状態のリンクが**10本**。`git ls-files -s` で見るとすべて `120000`、
つまり**リポジトリに登録されたシンボリックリンク**です。

```
$ git config --get core.hooksPath
/Users/rintaro/Job/LP/asb_lp_Y2K/.githooks    # 移動前のパス。存在しない
```

## 原因

**2026-09-07 12:39 にこのフォルダを `Job/LP/` から `完了タスク (LP)/` へ移した**、それだけです。
壊れ方が2種類あります。

**1. 共有ハーネスへのリンクは相対パス。** `../../scripts/harness` は
「**親フォルダが `Job/LP/` である**」という前提そのものです。プロジェクトを別の親の下に
置いた瞬間、10本まとめて宙に浮きます。

**2. `core.hooksPath` は絶対パスで、`.git/config` に入っています。** フォルダを移しても
git は追随しません。そして**存在しない `hooksPath` を git はエラーにしません** —
「フックが1つも無い」と同じ扱いで、黙って先に進みます。ここが「気づけなかった」の正体です。

## 直したもの

**移動先の親に、共有ハーネスへのリンクを3本置きました。**リンク側（10本）は git 管理下で、
絶対パスに書き換えるとその変更がコミットに乗り、clone した人の環境を壊します。
**触るのは指す先であって、リンクではありません。**

```
/Users/rintaro/Job/完了タスク (LP)/
  scripts -> /Users/rintaro/Job/LP/scripts
  harness -> /Users/rintaro/Job/LP/harness
  docs    -> /Users/rintaro/Job/LP/docs
```

`core.hooksPath` も移動後のパスへ付け替え（ローカル設定なのでコミットには乗りません）。

**これはこのプロジェクトだけの例外です。**

## 次から

**「移すと止まる」のは仕様です。直しません。** `完了タスク (LP)/` に入ったプロジェクトは
終わったプロジェクトで、そこでハーネスが止まるのは正しい挙動です。**この gotcha が
共有の `docs/` ではなくこのリポジトリの中にあるのは、そのためです。**

問題は止まったことではなく、**止まったことに気づかないまま2コミット進んだこと。**
なので覚えておくのは1つだけです。

> **移動したあとも作業を続けるなら、最初のコミットの前に1回だけ手で叩く。**
>
> ```
> node scripts/harness/harness-check.mjs
> ```
>
> これが動けばリンクは生きています。動かなければフックも死んでいます。
> **`git commit` の見た目では永久に判別できません。**

**「機械判定を手で当てたから同じこと」ではありません。**リンクが切れているあいだ、
プロジェクト側の契約（`harness/contracts/asobibar-lp.yaml`）は実体なので手で確認できました。
**しかし共有側の `secrets.yaml` と `workflow.yaml` は読むことすらできません。**
手当ては、いちばん確認したい契約にだけ届きません。

**これは順序の gotcha と同じ形です**
（[section-order-benefit-before-price.md](./section-order-benefit-before-price.md)、
[guessed-genre-from-a-word.md](./guessed-genre-from-a-word.md)）。
どれも**画面が正常に見えているときに間違えている。**
`harness-check` は「自分が走っているか」を教えてくれません。
