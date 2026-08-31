# LP projects — recommended repository structure

## Conclusion

ハーネスは「良いデザインを作る仕組み」ではなく、決めた品質を壊さない安全網です。
今後のLPを作りやすくするには、次の4層を分けます。

1. **共通理解** — `AGENTS.md` と `docs/PROJECT_CONTEXT.md`
2. **制作物** — HTML / CSS / JavaScript / 公開素材
3. **判断の記録** — design-docs / ADR / exec-plans / gotchas
4. **機械的な安全網** — harness / git hooks

## Recommended structure for the next LP

```text
project-name/
├── AGENTS.md                    # 全エージェント共通の正典
├── CLAUDE.md                    # AGENTS.mdへの入口だけ
├── README.md                    # 人が最短で起動するための説明
├── index.html
│
├── styles/
│   ├── tokens.css              # 色・書体・余白・easing
│   ├── base.css                # reset・body・共通タイポ
│   ├── components.css          # CTA・紙・写真枠・シール
│   ├── sections.css            # セクション固有レイアウト
│   ├── motion.css              # animation・reduced motion
│   └── responsive.css          # SP/PC差分
│
├── js/
│   ├── main.js                 # 初期化だけ
│   ├── motion.js               # scroll / timeline
│   ├── player.js               # 曲UIなど固有操作
│   └── reservation.js          # CTA URLと共通挙動
│
├── assets/
│   ├── images/                 # 公開する最適化済み画像
│   ├── video/                  # 公開動画
│   ├── fonts/                  # セルフホストフォント
│   └── source/                 # PSD・元画像。原則gitignore
│
├── docs/
│   ├── PROJECT_CONTEXT.md      # 現在地。Codex/Claude共通
│   ├── design-docs/
│   │   ├── visual-direction.md
│   │   ├── motion-direction.md
│   │   └── responsive-rules.md
│   ├── exec-plans/
│   │   ├── active/
│   │   └── completed/
│   ├── adr/                    # 戻しにくい判断
│   └── gotchas/                # 再発させたくないバグ
│
├── harness/
│   ├── contracts/              # 何を守るか
│   └── scenarios/              # いつ何を検証するか
├── scripts/harness/            # 検証エンジン
├── .githooks/                  # pre-commit / pre-push
├── .claude/                    # Claude固有。重要知識は置かない
└── .codex/                     # Codex固有。重要知識は置かない
```

## Why this is easier

### CSSを役割で分ける

1つの `styles.css` に追記し続けると、後から書いた同じセレクタが前の指定を上書きし、
「どれが正しいか」が分からなくなります。セクションごとのファイル乱立ではなく、
まず6ファイル程度へ責務で分けるのが安全です。

### 公開素材と元素材を分ける

`assets/source/` は重い元画像、`assets/images/` は実際に配信するWebP/JPEGだけにします。
ローカルでは見えるのにGitには入っていない事故を減らせます。

### 現在地と永久ルールを分ける

- `AGENTS.md`：毎案件でほぼ変わらない禁止事項・検証ルール
- `PROJECT_CONTEXT.md`：現在の構成、採用案、保留、キャッシュ番号

この2つを混ぜると、AGENTS.mdが作業日誌になり読まれなくなります。

### ハーネスへデザイン判断を任せない

ハーネスが得意なのは404、秘密情報、キャッシュ番号、容量、禁止色などです。
「写真が主役か」「余白が気持ちよいか」はPC/SPスクリーンショットと人の判断で確認します。
`manual` 判定は失敗ではなく、目視が必要だと正直に残す仕組みです。

## Migration policy for this LP

現在のASOBIBAR LPは公開中なので、今すぐ全ファイルを移動しません。
まず共通コンテキストを整え、次に大きなデザイン修正が落ち着いた時点で、
`styles.css` と `script.js` を別のexec-planで段階的に分割します。

一度にHTMLパス、CSS、JS、素材パスを全部変える移行は禁止です。
