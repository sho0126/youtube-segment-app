# YouTubeテーマ別動画セグメント抽出アプリ - 実装手順書

## 概要
このドキュメントでは、YouTubeテーマ別動画セグメント抽出アプリの実装手順と使用方法について詳しく説明します。このアプリケーションは、特定のテーマに関連するYouTube動画を検索し、関連セグメントを抽出して再生リスト化する機能を提供します。

## 1. システム要件

### 必要なソフトウェア
- Node.js (v14以上)
- npm (v6以上)
- モダンなWebブラウザ（Chrome、Firefox、Edgeなど）

### 必要なアカウント
- Google Cloud Platformアカウント（YouTube Data API v3のAPIキー取得用）

## 2. セットアップ手順

### プロジェクトのクローン/ダウンロード
```bash
git clone https://github.com/yourusername/youtube-segment-app.git
cd youtube-segment-app
```

または、以下のファイル構造を手動で作成します：

```
youtube-segment-app/
├── package.json
├── server.js
├── .env
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
```

### 依存パッケージのインストール
```bash
npm install
```

これにより、以下のパッケージがインストールされます：
- express: Webサーバーフレームワーク
- axios: HTTPリクエスト用クライアント
- dotenv: 環境変数管理

### YouTube Data APIキーの取得
1. Google Cloud Platform (https://console.cloud.google.com/) にアクセスしてログイン
2. 新しいプロジェクトを作成
3. 「APIとサービス」→「ライブラリ」から「YouTube Data API v3」を検索して有効化
4. 「APIとサービス」→「認証情報」から「認証情報を作成」→「APIキー」を選択
5. 作成されたAPIキーをコピー

### 環境変数の設定
プロジェクトのルートディレクトリに`.env`ファイルを作成し、以下の内容を追加します：

```
YOUTUBE_API_KEY=あなたのYouTube Data APIキー
PORT=3000
```

## 3. アプリケーションの起動

### 開発モード
```bash
npm run dev
```

### 本番モード
```bash
npm start
```

サーバーが起動したら、ブラウザで`http://localhost:3000`にアクセスしてアプリケーションを使用できます。

## 4. 使用方法

### 基本的な使い方
1. テーマ入力欄に検索したいテーマを入力（例：「人工知能」「プログラミング」など）
2. レベル（ビギナー、中級者、専門レベル）を選択
3. 希望する再生時間（30分、1時間、2時間）を選択
4. 「検索」ボタンをクリック
5. 関連する動画セグメントが再生リストとして表示され、自動的に再生が始まります
6. 再生リストの項目をクリックすると、そのセグメントから再生が始まります

### 検索のコツ
- 具体的なキーワードを使用すると、より関連性の高い結果が得られます
- 専門用語を含めると、より専門的な内容の動画が見つかりやすくなります
- 複数のキーワードを組み合わせることで、検索結果を絞り込むことができます

## 5. カスタマイズ方法

### フロントエンドのカスタマイズ

#### UIデザインの変更
`public/style.css`ファイルを編集することで、アプリケーションの見た目をカスタマイズできます。

```css
/* 例：ヘッダーの色を変更 */
h1 {
  color: #0066cc; /* 赤から青に変更 */
}

/* 例：ボタンのスタイルを変更 */
#search-button {
  background-color: #4CAF50; /* 緑色に変更 */
  border-radius: 8px; /* 角を丸くする */
}
```

#### HTML構造の変更
`public/index.html`ファイルを編集することで、アプリケーションの構造をカスタマイズできます。

```html
<!-- 例：フッターを追加 -->
<footer>
  <p>© 2025 YouTubeテーマ別セグメント抽出アプリ</p>
</footer>
```

### バックエンドのカスタマイズ

#### 検索パラメータの変更
`server.js`ファイルの検索APIエンドポイントを編集することで、YouTube APIへのリクエストパラメータをカスタマイズできます。

```javascript
// 例：検索結果の最大数を変更
app.get('/api/search', async (req, res) => {
  try {
    const { query, maxResults = 10 } = req.query; // 5から10に変更
    
    // ...残りのコード
  } catch (error) {
    // ...エラーハンドリング
  }
});
```

#### 新しいエンドポイントの追加
`server.js`ファイルに新しいエンドポイントを追加することで、機能を拡張できます。

```javascript
// 例：人気動画を取得するエンドポイントを追加
app.get('/api/trending', async (req, res) => {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet',
        chart: 'mostPopular',
        regionCode: 'JP',
        maxResults: 10,
        key: YOUTUBE_API_KEY
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching trending videos:', error);
    res.status(500).json({ error: 'Failed to fetch trending videos' });
  }
});
```

### セグメント抽出ロジックの改善
`public/script.js`ファイルの`createPlaylist`関数を編集することで、セグメント抽出のロジックをカスタマイズできます。

```javascript
// 例：より複雑なセグメント抽出ロジック
function createPlaylist(videos, theme) {
  currentPlaylist = [];
  currentIndex = 0;
  
  // 各動画から複数のセグメントを抽出
  videos.forEach(video => {
    const videoId = video.id.videoId;
    const title = video.snippet.title;
    const description = video.snippet.description;
    
    // テーマとの関連性を判断
    const titleRelevance = calculateRelevance(title, theme);
    const descriptionRelevance = calculateRelevance(description, theme);
    const overallRelevance = (titleRelevance * 0.7) + (descriptionRelevance * 0.3);
    
    if (overallRelevance > 0.5) { // 関連性スコアが0.5以上の場合のみ
      // 複数のセグメントを追加
      if (description.length > 500) {
        // 長い説明文の場合、複数のセグメントを抽出
        currentPlaylist.push({
          videoId,
          title,
          startTime: 0,
          endTime: 120, // 最初の2分間
          description: description.substring(0, 200) + '...',
          relevance: overallRelevance
        });
        
        currentPlaylist.push({
          videoId,
          title,
          startTime: 300, // 5分から
          endTime: 420, // 7分まで
          description: description.substring(0, 200) + '...',
          relevance: overallRelevance * 0.8 // 少し関連性を下げる
        });
      } else {
        // 短い説明文の場合、1つのセグメントのみ
        currentPlaylist.push({
          videoId,
          title,
          startTime: 0,
          endTime: 120,
          description,
          relevance: overallRelevance
        });
      }
    }
  });
  
  // 関連性でソート
  currentPlaylist.sort((a, b) => b.relevance - a.relevance);
  
  // 残りの処理...
}

// 関連性スコアを計算する関数
function calculateRelevance(text, theme) {
  if (!text) return 0;
  
  const themeWords = theme.toLowerCase().split(' ');
  const textLower = text.toLowerCase();
  
  let score = 0;
  themeWords.forEach(word => {
    if (word.length > 2 && textLower.includes(word)) {
      score += 0.3;
      
      // 完全一致の場合はボーナス
      if (textLower.includes(` ${word} `)) {
        score += 0.2;
      }
      
      // タイトルの先頭に出現する場合はボーナス
      if (textLower.startsWith(word)) {
        score += 0.3;
      }
    }
  });
  
  return Math.min(score, 1); // 最大1.0にキャップ
}
```

## 6. 高度な拡張方法

### 音声認識の追加
より高度なセグメント抽出のために、音声認識APIを統合することができます。例えば、OpenAI Whisper APIを使用して動画の音声をテキストに変換し、そのテキストを分析することで、より正確なセグメントを特定できます。

```javascript
// server.jsに音声認識エンドポイントを追加
app.post('/api/transcribe', async (req, res) => {
  try {
    const { videoUrl } = req.body;
    
    // 動画の音声を抽出（ffmpegなどを使用）
    // 音声をWhisper APIに送信
    // テキスト変換結果を返す
    
    res.json({ transcription: '音声認識結果のテキスト' });
  } catch (error) {
    console.error('Error transcribing video:', error);
    res.status(500).json({ error: 'Failed to transcribe video' });
  }
});
```

### ユーザーアカウント管理の追加
ユーザーが再生リストを保存できるように、アカウント管理機能を追加することができます。これには、データベース（MongoDB、SQLiteなど）の統合が必要です。

```javascript
// server.jsにユーザー認証エンドポイントを追加
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// MongoDBに接続
mongoose.connect(process.env.MONGODB_URI);

// ユーザーモデルを定義
const User = mongoose.model('User', {
  email: String,
  password: String,
  playlists: Array
});

// ユーザー登録エンドポイント
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      email,
      password: hashedPassword,
      playlists: []
    });
    
    await user.save();
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// ログインエンドポイント
app.post('/api/login', async (req, res) => {
  // 実装省略
});

// 再生リスト保存エンドポイント
app.post('/api/playlists', async (req, res) => {
  // 実装省略
});
```

### モバイル対応の強化
レスポンシブデザインを改善し、モバイルデバイスでの使いやすさを向上させることができます。

```css
/* style.cssにモバイル対応のスタイルを追加 */
@media (max-width: 768px) {
  .container {
    padding: 10px;
  }
  
  .search-container {
    flex-direction: column;
  }
  
  #player {
    width: 100%;
    height: auto;
  }
  
  #theme-input, select, #search-button {
    margin-bottom: 10px;
    width: 100%;
  }
}
```

## 7. トラブルシューティング

### APIキーの問題
- エラーメッセージ: "API key not valid. Please pass a valid API key."
  - 解決策: Google Cloud Platformで正しいAPIキーが生成され、制限がないことを確認してください。

### サーバー起動の問題
- エラーメッセージ: "Error: listen EADDRINUSE: address already in use :::3000"
  - 解決策: ポート3000がすでに使用されています。別のポートを使用するか、既存のプロセスを終了してください。

### 検索結果が表示されない
- 問題: 検索ボタンをクリックしても結果が表示されない
  - 解決策1: ブラウザのコンソールでエラーメッセージを確認してください。
  - 解決策2: APIキーが正しく設定されていることを確認してください。
  - 解決策3: ネットワークタブでAPIリクエストが正常に送信されているか確認してください。

## 8. 今後の拡張計画

### 短期的な拡張計画
1. 検索フィルターの追加（日付範囲、動画の長さなど）
2. 再生リストの保存と共有機能
3. 動画のサムネイル表示の改善

### 中期的な拡張計画
1. 音声認識によるコンテンツ分析の実装
2. ユーザーアカウント管理システムの追加
3. 関連テーマの推薦機能の強化

### 長期的な拡張計画
1. 機械学習モデルによる高度なコンテンツ分析
2. モバイルアプリ版の開発
3. 教育機関向けの特化機能の追加

## 9. リソースとリファレンス

### 公式ドキュメント
- [YouTube Data API v3](https://developers.google.com/youtube/v3/docs)
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [Express.js](https://expressjs.com/)

### チュートリアルとガイド
- [YouTube APIを使ったアプリケーション開発ガイド](https://developers.google.com/youtube/v3/getting-started)
- [Node.jsとExpressでRESTful APIを構築する方法](https://expressjs.com/en/guide/routing.html)

### コミュニティとサポート
- [Stack Overflow - YouTube API タグ](https://stackoverflow.com/questions/tagged/youtube-api)
- [GitHub Issues](https://github.com/yourusername/youtube-segment-app/issues)
