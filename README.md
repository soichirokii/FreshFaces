# FreshFaces

新入生の顔と名前を覚えるための GitHub Pages 向け Web アプリです。

## できること

- 本人プロフィール登録
- 顔写真の追加保存
- 顔認識して上位3候補を表示
- 今日の新入生ランダム紹介
- 「覚えた」管理
- Firestore で一覧共有

## はじめ方

1. `Live Server` などで [index.html](/Users/soichiro/Documents/New%20project/index.html) を `http://` で開く
2. プロフィールに顔写真を登録する
3. 顔認識や一覧、ランダム紹介を試す

## Firebase セットアップ

1. Firestore Database を有効化する
2. [config.js](/Users/soichiro/Documents/New%20project/config.js) に Firebase 設定値を入れる
3. `profiles` コレクションに読み書きできる Firestore ルールを設定する

## 補足

- 顔認識は `face-api.js` を CDN から読み込みます
- カメラは `file://` ではなく `http://localhost` などで開く必要があります
- プロフィール一覧は Firestore に共有保存されます
- `覚えた` 状態や一部UI状態はブラウザの `localStorage` に保存されます
- データを消したい場合はブラウザのサイトデータ削除か、アプリ内のプロフィール削除を使います
