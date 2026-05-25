# Field Album (SPA + PWA)

カメラ撮影を起点にアルバムを作成し、画像を IndexedDB に保存するオフライン対応アプリです。

## 主な機能

- アルバム一覧はテキストベース表示（タイトル、枚数、更新日時）
- 一覧右下の FAB から撮影して新規アルバム作成
- アルバム詳細でメタ情報表示 + 撮影画像のタイル表示
- 画像は JPEG に変換して IndexedDB に保存
- 画像サイズは最大辺を定数で制御（初期値 1600）
- PWA 対応（manifest + service worker）

## セットアップ

1. npm install
2. npm run dev

## ビルド

1. npm run build

## 画像リサイズ定数

画像処理の定数は [src/config/constants.ts](src/config/constants.ts) で変更できます。

- MAX_IMAGE_EDGE: デフォルト 1600
- JPEG_QUALITY: デフォルト 0.8

## 主要実装ファイル

- [src/pages/AlbumsPage.tsx](src/pages/AlbumsPage.tsx)
- [src/pages/AlbumDetailPage.tsx](src/pages/AlbumDetailPage.tsx)
- [src/lib/db.ts](src/lib/db.ts)
- [src/lib/image.ts](src/lib/image.ts)
- [vite.config.ts](vite.config.ts)
