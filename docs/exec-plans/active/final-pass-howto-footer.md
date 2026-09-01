# 最終調整：HOW TOの重なりとフッターの地

- **Started:** 2026-09-01
- **Rule:** [AGENTS.md](../../../AGENTS.md)
- **Completed path:** `docs/exec-plans/completed/final-pass-howto-footer.md`

## Goal

全ページを通した確認で見つかった、重なりの破綻と死んだ余白を潰す。
ヘッダーを明るくしたことで浮いたフッターの地も揃える。

## Scope

- [x] HOW TO 01：COLOR BANDのチップが写真の下に潜って端だけ出ていたのを、
      写真の縁をまたぐ位置へ移し、写真より前に出す
- [x] HOW TO 03：黄色いチケットが料理写真2枚のキャプションを隠していたのを、
      写真を上げてチケットに専用の帯を作る（PC・SP両方）
- [x] `.howto-step` の `min-height: 500px` を撤去（中身は最大438pxで、
      01の下に150px以上の空きができていた）
- [x] フッターの地を `#12191e` からヘッダーと対のミルキーグラデへ
- [x] フッターのロゴを墨版に、ナビ・コピーライトの文字色を明るい地に合わせる

## Non-scope

- `LINE_RESERVATION_URL`（未支給。「LINE予約で無料フードチケット」の文言と
  導線が食い違ったまま。店の確認待ち）
- `TODO(店舗確認)`：年齢制限 / 身分証確認 / キャンセルポリシー

## Constraints

- 濃い紫・黒を地に使わない
- チップは `mix-blend-mode: multiply` のままだと暗い写真の上で沈む

## Acceptance

- [x] HOW TO 01・03 で、文字とキャプションが他の要素に隠れない
- [x] HOW TO 01 の下に不自然な空きが残らない
- [x] SPで黄色いチケットが sticky する目次に隠れない
- [x] フッターに黒が残らず、ナビが読める

## Verification

- [x] `node scripts/harness/harness-check.mjs`
- [x] `node tools/verify/health.mjs`
- [x] PC 1440 / SP 390 で HOW TO 01・03 とフッターのキャプチャを目視

## Result

- harness-check: 機械判定はすべて pass。
- health.mjs: `docH 9106` / JSエラーなし / 読み込み失敗なし /
  グリフ1230字を検査して欠けなし。
- キャプチャ: PC・SPとも、チップ・キャプション・チケットが
  互いに隠れないことを確認。

踏んだもの:

- チップを写真より前に出しても、`multiply` のままだと暗部で消えて
  「切れたチップ」に見えたままだった。この3枚だけ `normal` に戻し、
  背景のアルファを 0.92 まで上げた。
- SPではチケットを `bottom: 0` に置くと、セクション内で sticky する目次に
  下端が隠れる。54px 上げて逃がした。

残っている判断:

- 「LINE予約で無料フードチケットをプレゼント！」の文言に対して、
  LINE予約の導線がページ上に存在しない（`LINE_RESERVATION_URL` が空）。
  URLを入れるか文言を落とすかの判断が要る。
