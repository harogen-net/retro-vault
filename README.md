# Retro Vault

Retro Vault は、レトロゲームのパスワード画面をアルバム単位で保存・管理するためのPWAです。ゲームごとにアルバムを作り、パスワード画面や進行状況のスクリーンショットを「シーン」として残せます。

iOSでの利用を主眼に、オフラインでも閲覧・編集できる構成を目指しています。保存した画像は端末のブラウザ内に保持されるため、ネットワークにつながっていない場所でも確認できます。

## 使い方のイメージ

- 1アルバム = 1ゲーム、または1つの管理単位として使う
- 1シーン = パスワード画面や進行状況の記録として使う
- 1シーンには、1枚以上の画像をまとめて保存できる
- シーンごとに、レベル、ステージ、補足メモなどを残せる

## 主な機能

- アルバム一覧
- 撮影または画像選択からのアルバム作成
- アルバム詳細でのサムネイル一覧表示
- シーン詳細での拡大、パン、複数画像の切り替え
- シーンメモの編集
- シーンへの画像追加、画像削除
- 複数シーンの選択、別アルバムへの移動、削除
- アルバム名変更
- アルバム削除
- アルバム単位のZIPエクスポート
- アルバム単位のZIPインポート

## 画面構成

基本の画面遷移は、次の3階層です。

1. アルバム一覧
2. アルバム詳細
3. シーン詳細

モバイルファーストで、iOSのブラウザから使いやすい操作感を優先しています。

## データ保存

永続化ストレージには IndexedDB を使用します。アプリ内部では画像データを Blob として保持し、サムネイルも保存時に別Blobとして生成します。

アルバムのインポート/エクスポートではZIPファイルを使用します。ZIP内には `album.json` を含め、メタ情報、アルバム情報、シーン情報、画像情報をまとめて保存します。画像本体はJSON内でbase64文字列として扱います。

エクスポートファイル名は、アルバム名を元にした `アルバム名.zip` です。アーカイブには形式バージョンを持たせ、対応していないバージョンは読み込み時にエラーにします。

## PWAと配信

- Service Worker はアプリ起動時に登録し、自動更新を有効化します。
- 設定メニューからアプリの手動リロードを実行できます。
- 手動リロード時は Service Worker の更新、待機中Service Workerの切り替え要求、登録解除を順に試行します。
- 手動リロード時は Cache Storage の既存キャッシュ削除も試行します。
- リロード後もバージョン情報を表示できるよう、pending情報を一時保存して引き継ぎます。
- 設定メニューでは version、deploy、hash を確認できます。
- GitHub Pages 配信を想定し、ルーティングには Hash Router を採用しています。

## 技術スタック

- React 19
- TypeScript
- Vite
- Ionic
- IndexedDB
- vite-plugin-pwa

## 開発

```bash
npm install
npm run dev
```

主な npm scripts は次の通りです。

- `npm run dev`: 開発サーバーを起動
- `npm run build`: TypeScript と Vite で本番ビルド
- `npm run lint`: ESLint を実行
- `npm run preview`: ビルド結果をローカルで確認
- `npm run deploy`: `dist` を GitHub Pages 用ブランチへ公開

## GitHub Pages へのデプロイ

このプロジェクトは GitHub Pages 配信を想定しており、[vite.config.ts](vite.config.ts) で base パスを設定しています。ルーティングは [src/App.tsx](src/App.tsx) で Hash Router を使っているため、直接アクセス時の404を避けられます。

```bash
npm run deploy
```

GitHub リポジトリ側では、Pages の公開元を `gh-pages` ブランチの root に設定します。

## 実装ルール

- ページ専用コンポーネントは `src/pages/(domain)` 配下に置く
- 再利用前提コンポーネントのみ [src/components](src/components) 配下に置く
- ページの状態遷移や副作用は hooks へ寄せる
- 画像処理は共通hookまたはユーティリティにまとめ、重複を避ける

## 主な実装ファイル

- [src/App.tsx](src/App.tsx): ルーティングと全体レイアウト
- [src/pages/AlbumsPage.tsx](src/pages/AlbumsPage.tsx): アルバム一覧画面
- [src/pages/AlbumDetailPage.tsx](src/pages/AlbumDetailPage.tsx): アルバム詳細画面
- [src/pages/PhotoViewPage.tsx](src/pages/PhotoViewPage.tsx): シーン詳細画面
- [src/components/AppFooterNav.tsx](src/components/AppFooterNav.tsx): フッターナビゲーション、インポート、設定メニュー
- [src/hooks/useAlbumMutations.ts](src/hooks/useAlbumMutations.ts): アルバムとシーンの更新処理
- [src/lib/db.ts](src/lib/db.ts): IndexedDB、ZIPエクスポート、インポート
- [src/lib/image.ts](src/lib/image.ts): 画像リサイズとJPEG変換
- [docs/plan.md](docs/plan.md): プロダクト方針と実装計画
