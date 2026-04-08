# FreshFaces

新入生の顔と名前を覚えるための GitHub Pages 向け Web アプリです。

## できること

- Google ログイン
- `@kamiyama.ac.jp` ドメイン制限
- ログインなしのローカル体験モード
- 本人プロフィール登録
- 顔写真の追加保存
- 顔認識して上位3候補を表示
- 今日の新入生ランダム紹介
- 「覚えた」管理
- 相席募集の作成と参加
- JSON エクスポート・インポート

## はじめ方

1. `Live Server` などで [index.html](/Users/soichiro/Documents/New%20project/index.html) を `http://` で開く
2. `@kamiyama.ac.jp` の Google アカウントでログインする
3. プロフィールに顔写真を登録する
4. 顔認識や一覧、ランダム紹介を試す

## Firebase セットアップ

1. `Authentication` で Google ログインを有効化
2. `Firestore Database` を作成
3. [config.js](/Users/soichiro/Documents/New%20project/config.js) に Firebase 設定値を入れる
4. [firestore.rules](/Users/soichiro/Documents/New%20project/firestore.rules) を Firestore Rules に反映する

## 補足

- 顔認識は `face-api.js` を CDN から読み込みます
- カメラは `file://` ではなく `http://localhost` などで開く必要があります
- 顔写真と一部状態はブラウザの `localStorage` にも保存されます
