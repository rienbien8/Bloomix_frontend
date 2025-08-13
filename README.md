# 推しスポNavi フロントエンド（Home画面）

- Vite + React + TypeScript + Tailwind
- スマホ対応のUI（スクロール可）
- `.env` の `VITE_API_BASE_URL` に FastAPI のベースURLを設定してください（例: `http://localhost:8000`）。
- APIが未準備でもモックデータで動作します。

## セットアップ
```bash
npm install
npm run dev
```

## フォルダ階層（抜粋）
```
<project-root>/
├─ package.json
├─ vite.config.ts
├─ index.html
├─ tailwind.config.js
├─ .env / .env.example
└─ src/
   ├─ App.tsx
   ├─ main.tsx
   ├─ vite-env.d.ts
   ├─ pages/
   │   └─ Home.tsx
   ├─ components/
   │   ├─ Header.tsx
   │   ├─ HeroMapCard.tsx
   │   ├─ SectionHeader.tsx
   │   ├─ SpotCard.tsx
   │   ├─ ContentCard.tsx
   │   └─ BottomNav.tsx
   └─ modules/
       ├─ api.ts
       ├─ types.ts
       └─ mock.ts
```

## デプロイ（Azure静的Webアプリの例）
- GitHubにこのリポジトリを作成しPush
- Azure Static Web Appsで、フレームワーク = Vite、App location = `/`, Output location = `dist` を指定してください。