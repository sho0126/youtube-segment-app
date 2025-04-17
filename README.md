# YouTubeテーマ別動画セグメント抽出アプリ

特定のテーマを入力すると、それにまつわる内容のYouTube動画を検索、解析して該当箇所のみを再生リスト化するアプリケーションです。

## 機能

- テーマに基づいたYouTube動画の検索
- ユーザーレベル（ビギナー、中級者、専門レベル）に応じたコンテンツのフィルタリング
- 再生時間の設定（30分〜2時間）
- 関連セグメントの抽出と再生リスト化
- 要約文や解説文の生成
- 関連テーマの提案

## デモ

![アプリケーションのスクリーンショット](https://example.com/screenshot.png)

## 技術スタック

- **フロントエンド**: HTML, CSS, JavaScript
- **バックエンド**: Node.js, Express
- **外部API**: YouTube Data API v3, YouTube IFrame Player API

## セットアップ方法

### 前提条件

- Node.js (v14以上)
- npm (v6以上)
- YouTube Data API v3のAPIキー

### インストール

1. リポジトリをクローン
```bash
git clone https://github.com/sho0126/youtube-segment-app.git
cd youtube-segment-app
```

2. 依存パッケージをインストール
```bash
npm install
```

3. 環境変数の設定
`.env.example`ファイルを`.env`にコピーし、YouTube Data APIのキーを設定
```bash
cp .env.example .env
# .envファイルを編集してYOUTUBE_API_KEYを設定
```

4. アプリケーションの起動
```bash
npm start
```

5. ブラウザで以下のURLにアクセス
```
http://localhost:3000
```

## Renderへのデプロイ方法

1. Renderアカウントを作成し、ログイン
2. 「New +」→「Web Service」を選択
3. GitHubリポジトリを連携
4. 以下の設定を行う：
   - **Name**: youtube-segment-app
   - **Environment**: Node
   - **Build Command**: npm install
   - **Start Command**: node server.js
5. 「Environment」タブで環境変数を設定：
   - `YOUTUBE_API_KEY`: YouTube Data APIのキー
6. 「Create Web Service」ボタンをクリックしてデプロイを開始

## 使用方法

1. テーマ入力欄に検索したいテーマを入力（例：「人工知能」「プログラミング」など）
2. レベル（ビギナー、中級者、専門レベル）を選択
3. 希望する再生時間（30分、1時間、2時間）を選択
4. 「検索」ボタンをクリック
5. 関連する動画セグメントが再生リストとして表示され、自動的に再生が始まります
6. 再生リストの項目をクリックすると、そのセグメントから再生が始まります

## 制限事項

- 現在のバージョンでは、動画のタイトルと説明文のみを使用して関連性を判断しています
- セグメントは簡易的に各動画の最初の2分間に固定されています
- YouTube Data API v3には1日あたりのクォータ制限（10,000ユニット）があります

## 今後の拡張予定

- 音声認識によるコンテンツ分析の実装
- 自然言語処理を使用したより正確な関連セグメントの特定
- ユーザーアカウント管理と再生リスト保存機能
- モバイル対応の強化
- 複数言語対応

## ライセンス

MIT

## 謝辞

このプロジェクトはYouTube Data API v3を使用しています。
