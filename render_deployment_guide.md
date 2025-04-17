# Renderデプロイ手順

このドキュメントでは、YouTubeテーマ別動画セグメント抽出アプリをRenderにデプロイする詳細な手順を説明します。

## 前提条件

- GitHubアカウント
- Renderアカウント
- YouTube Data API v3のAPIキー

## 手順

### 1. GitHubリポジトリの準備

1. GitHubにログインし、[https://github.com/sho0126](https://github.com/sho0126)にアクセスします。
2. 「Repositories」タブをクリックし、「New」ボタンをクリックします。
3. リポジトリ名に「youtube-segment-app」を入力します。
4. 「Public」を選択し、「Create repository」ボタンをクリックします。
5. 「uploading an existing file」リンクをクリックします。
6. 以下のファイルをアップロードします：
   - package.json
   - server.js
   - .env.example
   - README.md
   - public/index.html
   - public/style.css
   - public/script.js
7. 「Commit changes」ボタンをクリックします。

### 2. Renderアカウントの設定

1. [Render](https://render.com/)にアクセスし、アカウントを作成またはログインします。
2. ダッシュボードから「New +」ボタンをクリックし、「Web Service」を選択します。

### 3. GitHubリポジトリの連携

1. 「Connect a repository」セクションで「GitHub」を選択します。
2. 必要に応じてGitHubアカウントへのアクセスを許可します。
3. リポジトリリストから「sho0126/youtube-segment-app」を選択します。

### 4. Webサービスの設定

1. 以下の設定を行います：
   - **Name**: youtube-segment-app
   - **Environment**: Node
   - **Region**: お好みの地域（通常は最も近い地域を選択）
   - **Branch**: main
   - **Build Command**: npm install
   - **Start Command**: node server.js
   - **Plan**: Free（無料プラン）

2. 「Advanced」セクションを開き、以下の設定を行います：
   - **Auto-Deploy**: Yes（GitHubリポジトリが更新されると自動的にデプロイ）

3. 「Environment Variables」セクションで以下の環境変数を追加します：
   - **Key**: YOUTUBE_API_KEY
   - **Value**: あなたのYouTube Data APIキー

4. 「Create Web Service」ボタンをクリックします。

### 5. デプロイの確認

1. デプロイが完了するまで待ちます（通常は数分かかります）。
2. デプロイが成功すると、Renderが提供するURLでアプリケーションにアクセスできます。
   - 例: https://youtube-segment-app.onrender.com

### 6. トラブルシューティング

デプロイに問題がある場合は、以下を確認してください：

1. **ビルドログ**: Renderダッシュボードの「Logs」タブでビルドエラーを確認します。
2. **環境変数**: YOUTUBE_API_KEYが正しく設定されているか確認します。
3. **依存関係**: package.jsonに必要な依存関係がすべて含まれているか確認します。
4. **Node.jsバージョン**: Renderが使用するNode.jsバージョンと互換性があるか確認します。

### 7. アプリケーションの更新

GitHubリポジトリに変更をプッシュすると、Renderは自動的に新しいバージョンをデプロイします。手動でデプロイする場合は、Renderダッシュボードの「Manual Deploy」ボタンをクリックします。

### 8. カスタムドメインの設定（オプション）

1. Renderダッシュボードの「Settings」タブをクリックします。
2. 「Custom Domain」セクションで「Add Custom Domain」ボタンをクリックします。
3. 画面の指示に従って、DNSレコードを設定します。

### 9. SSL証明書（オプション）

Renderは自動的にSSL証明書を提供し、HTTPSでアプリケーションにアクセスできるようにします。カスタムドメインを使用する場合も、SSL証明書は自動的に発行されます。

### 10. 無料プランの制限

Renderの無料プランには以下の制限があります：
- 一定時間使用されないとスリープ状態になります
- 初回アクセス時に起動に時間がかかることがあります
- 月間の使用時間に制限があります

本番環境で使用する場合は、有料プランへのアップグレードを検討してください。
