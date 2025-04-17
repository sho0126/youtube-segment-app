// 必要なパッケージのインポート
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// 静的ファイルの提供
app.use(express.static('public'));
app.use(express.json());

// YouTube検索APIエンドポイント
app.get('/api/search', async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.query;
    
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        maxResults,
        key: YOUTUBE_API_KEY,
        type: 'video'
      }
    }) ;
    
    // APIキーが無効または制限されている場合のチェック
    if (!response.data || !response.data.items) {
      console.error('Invalid YouTube API response:', response.data);
      return res.status(500).json({ 
        error: 'Invalid YouTube API response', 
        message: 'YouTube APIキーが無効または制限されている可能性があります。'
      });
    }
    
    // 検索結果を返す
    res.json(response.data);
  } catch (error) {
    console.error('Error searching YouTube:', error);
    res.status(500).json({ 
      error: 'Failed to search YouTube',
      message: error.message
    });
  }
});

// 動画詳細情報取得エンドポイント
app.get('/api/video/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,contentDetails',
        id,
        key: YOUTUBE_API_KEY
      }
    }) ;
    
    // 動画情報を返す
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching video details:', error);
    res.status(500).json({ error: 'Failed to fetch video details' });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
