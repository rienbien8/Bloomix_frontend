# PWA (Progressive Web App) 実装ガイド

## 概要

このプロジェクトは、推しアーティストのスポットを発見・共有する PWA アプリです。モバイルファーストの設計で、ネイティブアプリのような体験を提供します。

## 実装された機能

### 🚀 基本 PWA 機能

- **Service Worker**: オフライン対応とキャッシュ機能
- **Web App Manifest**: アプリの外観と動作の定義
- **インストール促進**: ホーム画面への追加を促す UI
- **オフライン対応**: ネットワーク接続がなくても基本機能を利用可能

### 📱 モバイル最適化

- **レスポンシブデザイン**: 様々な画面サイズに対応
- **タッチフレンドリー**: モバイルデバイスでの操作に最適化
- **スタンドアロンモード**: ブラウザの UI を隠してネイティブアプリのような体験

### 🎨 見栄え重視の UI

- **グラデーション**: 美しい色のグラデーション効果
- **アニメーション**: スムーズなトランジションとホバー効果
- **シャドウ**: モダンな立体感のあるデザイン
- **アイコン**: 統一感のあるアイコンセット

## ファイル構成

```
frontend/
├── public/
│   ├── manifest.json          # PWAマニフェスト
│   ├── sw.js                 # Service Worker
│   ├── favicon.svg           # ファビコン
│   └── icons/                # アプリアイコン
│       ├── icon-192x192.svg  # 192x192アイコン
│       ├── icon-512x512.svg  # 512x512アイコン
│       └── ...               # その他のサイズ
├── src/
│   ├── components/
│   │   ├── PWAInstaller.tsx  # インストール促進UI
│   │   ├── OfflineDetector.tsx # オフライン状態表示
│   │   └── OfflinePage.tsx   # オフラインページ
│   ├── hooks/
│   │   └── usePWA.ts         # PWA状態管理フック
│   └── app/
│       └── layout.tsx        # PWAメタタグ設定
└── scripts/
    └── generate-icons.js     # アイコン生成スクリプト
```

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. アイコンの生成

```bash
npm run generate-icons
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

### 4. PWA ビルド

```bash
npm run pwa:build
```

## PWA のテスト

### ブラウザでのテスト

1. Chrome DevTools の Application タブを開く
2. Manifest セクションでマニフェストの内容を確認
3. Service Workers セクションで SW の登録状況を確認

### インストールテスト

1. Chrome のアドレスバーに表示されるインストールアイコンをクリック
2. または、メニューから「アプリをインストール」を選択

### オフラインテスト

1. DevTools の Network タブで Offline にチェック
2. ページをリロードしてオフライン動作を確認

## カスタマイズ

### アプリ名の変更

`public/manifest.json` の `name` と `short_name` を編集

### テーマカラーの変更

`public/manifest.json` の `theme_color` と `background_color` を編集

### アイコンの変更

`scripts/generate-icons.js` の SVG 内容を編集してから `npm run generate-icons` を実行

## パフォーマンス最適化

### キャッシュ戦略

- **重要リソース**: HTML、CSS、JS、マニフェスト
- **画像**: ユーザーがよく見る画像をキャッシュ
- **API**: 重要なデータをキャッシュ

### オフライン対応

- **基本機能**: 地図表示、保存されたスポット情報
- **フォールバック**: オフライン時の適切なメッセージ表示

## ブラウザ対応

### 完全対応

- Chrome 67+
- Edge 79+
- Firefox 67+

### 部分対応

- Safari 11.1+ (iOS 11.3+)
- Samsung Internet 8.2+

## トラブルシューティング

### Service Worker が登録されない

1. HTTPS 環境で実行されているか確認
2. ブラウザのコンソールでエラーメッセージを確認
3. ブラウザの設定で Service Worker が有効になっているか確認

### インストールプロンプトが表示されない

1. マニフェストファイルが正しく読み込まれているか確認
2. Service Worker が正常に登録されているか確認
3. ブラウザの対応状況を確認

### オフライン時にページが表示されない

1. Service Worker のキャッシュ設定を確認
2. オフライン時のフォールバック処理を確認

## 今後の拡張予定

- [ ] プッシュ通知機能
- [ ] バックグラウンド同期
- [ ] オフライン時のデータ編集
- [ ] アプリ更新通知
- [ ] パフォーマンスメトリクス

## 参考資料

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Next.js PWA](https://nextjs.org/docs/app/building-your-application/optimizing/progressive-web-apps)
