# ASOBIBAR Y2K NIGHT — LP

2026年9月開催の Y2K NIGHT 告知ページ。静的サイト（HTML / CSS / JS のみ、ビルド不要）。

## 構成

- `index.html` — 全セクション
- `styles.css` — 紙の素材システムとモーション
- `script.js` — シーンモーション、スクラブ、カウントアップ
- `assets/` — 実際に使用している画像のみ

## ローカルで見る

```
python3 -m http.server 8765
```

http://localhost:8765 を開く。

## 予約リンク

`script.js` の `LINE_RESERVATION_URL` に https の URL を入れると、
全 CTA がそちらへ切り替わる。空の場合は公式HPへフォールバックする。
