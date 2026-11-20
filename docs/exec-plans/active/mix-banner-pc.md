# MIXバナーをPC・SPとも新バナーに差し替え、1枚のリンクにする

- **Started:** 2026-11-20
- **Rule:** [docs/exec-plans/README.md](../README.md)
- **Completed path:** `docs/exec-plans/completed/mix-banner-pc.md`

## Goal

04（MIXゾーン）のバナーを、PCでも依頼者から届いた新ビジュアル
「ASOBIBAR ミックスマッチ上等」に差し替える。これで 2026-11-17 にSPだけ
入れ替えて生まれた**PC「MIX交流上等」／SP「ミックスマッチ上等」の名前の
食い違いが消える。**

## Scope

- [x] `~/Desktop/ミックス交流上等バナー-PC.png`（1731×910・PNG 1.5MB）を
      `assets/mix-band-key-pc.webp`（1440×758・q84・130KB）に変換して追加
- [x] 原寸PNGを `assets/MIX-BAND-PC.png` として手元に残す（.gitignore対象。
      SP版の `MIX-BAND.png` と同じ扱い）
- [x] `index.html` の `<img>` を新ファイルへ。`width`/`height` を 1440×758 に直す
- [x] **alt を差し替え後の焼き込み文言に合わせる。**冒頭を「MIX交流上等」から
      「ASOBIBAR ミックスマッチ上等」へ。写っている人の描写も6人の並びに直す
- [x] 役目を終えた `assets/mix-band-key.webp`(750×627) を削除し、
      `.gitignore` の許可リストから外す
- [x] `styles.css` の「原寸 750px なので」というコメントを現状に直す（文言のみ）

## 追記 2026-11-20（SPも差し替え・Coming soon 撤去・リンク化）

依頼者からSP用の新バナーも届いた。**こちらも下端に「詳細はこちら ＞」の帯が
付いた版。**あわせて3つの指示:

1. SPバナーを差し替える
2. `Coming soon...` を消す
3. **あとでURLを渡すので、バナーから遷移するようにしておく**

- [x] `~/Desktop/ミックス交流上等バナー.png`（1080×1080）を
      `assets/MIX-BAND-SP.png` に控え、`assets/mix-band-key-sp-v2.webp`
      （1080×1080・q84・135KB）として書き出し
- [x] 旧 `mix-band-key-sp.webp`（11-17版）を削除し、許可リストから外す
- [x] `<p class="mix-soon">Coming soon...</p>` を削除。`.mix-soon` の規則も
      HTMLに0件であることを確認のうえ styles.css から削除
- [x] バナー全体を `<a class="mix-teaser__link">` で包む
- [x] **帯を落とすA/Bの判断は不要になった。**帯が本物のリンクになるため、
      届いたままの絵を両方そのまま使う

**11-17版SPにあった `ORIJINAL EVENT` の綴り間違いは、この版で `ORIGINAL` に
直っている。**

### 遷移先URL（2026-11-20 受領・反映済み）

`https://mix-band-lp.hic-marketing.com/` — `<title>` が
「MIX交流上等バンド | ASOBIBAR」で、意図した飛び先であることを確認済み（200）。

- [x] `href` を追加
- [x] **別サイトなので `target="_blank" rel="noopener noreferrer"`。**
      このLPの他の外部リンク（asobibar.net、asb-over28-campaign）と同じ扱いで、
      依頼者に聞き直さずこちらで揃えた
- [x] alt の末尾を「ダーツのある店内に集まった男女」から「詳細はこちら」に。
      **リンクになった以上、alt はリンクの読み上げ文**なので、
      絵の説明ではなく行き先を言う必要がある。
      `<a>` に `aria-label` は足さない（alt が捨てられる）

## 追記 2026-11-20（PCの表示を大きく）

公開後、依頼者から「PCで見るとバナーがかなり小さく感じる」。

- [x] `.mix-teaser` の上限を **768px以上でだけ 640 → 984** に広げた。
      **984 は05の店舗カード（`.venue-pick`）と同じ幅**で、ページでいちばん広い塊に
      揃えてある。勝手に決めた数字ではない
- [x] **SPは 640 のまま。**SPバナーは正方形で、390px の画面ですでに 365px ——
      画面幅いっぱいまで出ており、広げる余地が無い
- [x] 画像を **原寸 1731×910（q80・155KB）** で配るようにした
      （`mix-band-key-pc-xl.webp`）。984枠で 1.76倍あり、Retinaでも
      焼き込み文字が潰れない。1440px 版のままだと 1.46倍に落ちていた
- [x] `styles.css?v=506`

実測（幅 / バナー / 節の内側の左右の余白）:
768→699px・35px / 900→819px・41px / 1024→932px・46px /
1280以上→984px・148px以上。左右対称で、節の枠に触っていない。

**横スクロールは増えていない。**768px の 2px は `wall__track` が出している
既存のもので、**本番にも同じだけ出ている**ことを同条件で測って確認した。

## Non-scope

- **SPの表示幅は変えない**（上記のとおり広げる余地が無い）
- **`<a>` に `target="_blank"` は付けていない。**同じサイト内か外部かが
  URLを見るまで決められないため。URLと一緒に判断する

## Constraints

- 画像にクエリ文字列でのキャッシュ破りを付けていないプロジェクトなので、
  **中身を差し替えるのではなくファイル名を変える**（`mix-band-key-pc.webp`）。
  同名で上書きすると、既に見た人にはCDNの古い画像が出続ける
- `<picture>` は alt を1つしか持てない。PC/SPで焼き込み文言が違うので、
  **事実の側（4〜6組・ゲームで指名・全員オレンジバンド）を alt に残す。**
  この事実を持つ場所がHTMLの他に無いため

## Acceptance

- [x] 768px以上で `currentSrc` が `mix-band-key-pc.webp`、767px以下で
      `mix-band-key-sp-v2.webp`（390 / 767 / 768 / 1280 で実測）
- [x] PCは 638×336、SPは正方形（390px→363×363、767px→638×638）
- [x] `.mix-soon` がDOMに存在しない
- [x] href 追加前: Tab 120回で `.mix-teaser__link` に止まらず、`cursor` も `auto`
- [x] href 追加後: Tabで止まる・`cursor: pointer`・実際に押して
      mix-band-lp.hic-marketing.com が新しいタブで開く
- [x] 旧 `mix-band-key.webp` / `mix-band-key-sp.webp` への参照が1件も残っていない
- [x] 4幅ともコンソールエラー0件、404が0件

## Verification

- [x] `node scripts/harness/harness-check.mjs`
- [ ] **実機確認（未実施）。**下の Result に残課題として書いた
- [x] **実際に押して、新しいタブで mix-band-lp.hic-marketing.com が開く**

## Result

04（MIXゾーン）を、バナー2枚の差し替え・`Coming soon...` の撤去・バナー全体の
リンク化まで一度に通した。

**やったこと**

- PC `mix-band-key-pc.webp`(1440×758/130KB)、SP `mix-band-key-sp-v2.webp`
  (1080×1080/135KB)。旧 `mix-band-key.webp` / `mix-band-key-sp.webp` は削除
- `Coming soon...` と `.mix-soon` を削除（HTMLに0件を確認してからCSSを消した）
- `<a class="mix-teaser__link" href="https://mix-band-lp.hic-marketing.com/"
  target="_blank" rel="noopener noreferrer">` でバナー全体を包んだ
- PC/SPで名前が「ミックスマッチ上等」に揃い、`ORIJINAL` の綴り間違いも解消

**各検証が実際に返した値**

- `harness-check`: machine-verified は全通過、manual が6件
- 390 / 767 / 768 / 1280px で `currentSrc` が期待どおり切り替わり、
  PC 638×336 / SP 363×363・638×638。コンソールエラー0件、404が0件
- href 追加前: Tab 120回で `.mix-teaser__link` に止まらず、`cursor: auto`
- href 追加後: Tabで止まり `cursor: pointer`。390px と 1280px の両方で、
  焼き込みの帯の位置とバナー中央のどちらを押しても
  `https://mix-band-lp.hic-marketing.com/` が**新しいタブで**開き、
  元のLPはそのまま残ることを実測
- 飛び先の `<title>` が「MIX交流上等バンド | ASOBIBAR」であることを確認（200）
- バナー下端の帯が、下部固定のLINE予約バーに覆われていないことを
  `elementFromPoint` で確認（390 / 768 / 1280）

**残っている未検証**

- **実機確認をしていない。**このプロジェクトで一度も実施できていない。
  ヘッドレスChromeでの実測なので、iOS Safari の `target="_blank"` の挙動
  （ポップアップブロックの扱い）と、実機でのタップ位置のずれは未確認。
  リスクは低いが0ではない
- **バナーの写真の転載可否**は依頼者判断のまま（05の店舗写真と同じ扱い）
