# 画づくりのナレッジをharness-checkに出す

- **Started:** 2026-09-01
- **Rule:** [docs/exec-plans/README.md](../README.md)
- **Completed path:** `docs/exec-plans/completed/visual-knowledge-in-harness.md`

## Goal

共有ハーネスに追加された `docs/design-docs/lp-visual-knowledge.md`（画づくりの判断基準）が、
`harness-check` の出力に毎回現れる。いまはどの contract からも参照されておらず、
**存在するが読まれる保証がない。**

## Scope

- [x] Y2K の `design-direction`（`harness/contracts/asobibar-lp.yaml`）の note から参照させる
- [x] 共有 `harness/contracts/lp-design.yaml` に `visual-direction-is-one-decision` を追加
- [x] 知識2本（cvr / visual）を Y2K の `docs/design-docs/` に symlink して辿れるようにする

## Non-scope

- `lp-design.yaml` 全体を Y2K にリンクすること。設計段階の問い9行はこのLPでは消化できず、
  元からある manual 行まで読み飛ばされる。**画づくりの1行だけを Y2K 側の
  `design-direction` に寄せる形にした。**
- 画づくりを機械判定にすること。彩度や世界観はパターンで見られない。

## Constraints

- **`rule:` フィールドは使えない。** `harness-check.mjs` は `rule` を **fail のときだけ**
  出力する（[harness-check.mjs:107](../../scripts/harness/harness-check.mjs)）。
  `manual` は永久に fail しないので、そこに書いたパスは誰にも表示されない。
  **参照は `note` に書く。**
- 知識の実体は共有ハーネス（`Job/LP/`）にあり、**Y2Kリポジトリの外**。
  clone した環境ではパスが切れる。既存の symlink 8本と同じ制約。
- `scripts/harness/` `harness/scenarios/` の編集は全端末での任意コード実行に等しい。
  今回触るのは `harness/contracts/` のみ。

## Acceptance

- [x] Y2K の `harness-check` に画づくりへの参照が毎回出る
- [x] 新規LP（雛形から立ち上げた状態）でも `visual-direction-is-one-decision` が出る
- [x] Y2K の manual 件数が増えない（6件のまま）
- [x] エンジンのテストが通る
- [x] symlink に dead link が無い

## Verification

- [x] `node scripts/harness/harness-check.mjs`（Y2K）
- [x] 雛形をgitリポジトリに立てて `harness-check`（新規LP相当）
- [x] `node --test scripts/harness/lib/*.test.mjs`
- [x] `find -type l` で dead link ゼロ

## Result

`design-direction` の note に画づくりの要点と参照先を足した。Y2K では毎回
`harness-check` に出る。共有側には `visual-direction-is-one-decision` を1本追加し、
雛形から立てた新規LPで表示を確認した（そちらは manual 12件）。

**`rule:` では駄目だと分かったのが実装上の要点。** 最初 `rule: docs/design-docs/...` で
参照させようとしたが、`harness-check.mjs` の `printResult` は `rule` を fail 分岐の中で
だけ出力する。`manual` は fail しないので、**書いても永久に表示されない。**
note に書き直した。

知識2本を Y2K の `docs/design-docs/` に symlink した。note に書いたパスが実在し、
プロジェクト内から開けるようになる。

### 検証の結果

| 検証 | 結果 |
| --- | --- |
| Y2K の `harness-check` | 画づくりへの参照が `design-direction` に出る。manual は6件のまま |
| 新規LP相当（雛形＋git init） | `visual-direction-is-one-decision` が出る。manual 12件 |
| エンジンのテスト | 43 pass / 0 fail |
| dead link | ゼロ |

### 残っている risk

- **知識の実体はリポジトリ外。** clone した環境では symlink が切れ、note のパスも
  開けない。ハーネス本体と同じ制約で、復元手順は `AGENTS.md` にある。
- Y2K に出るのは画づくりの1行だけ。**設計段階の9行（単一CV・ペルソナ・目標CVR）は
  出ない。**このLPでは消化できないという判断だが、次の新規LPでは効く。
- note は読まれて初めて効く。`harness-check` が走るのはコードを書いた後なので、
  **着手前に読ませる担保は AGENTS.md 側にしかない。**
