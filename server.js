// 必要なパッケージのインポート
const express = require('express');
const axios = require('axios');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// OpenAI クライアントの初期化
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// 静的ファイルの提供
app.use(express.static('public'));
app.use(express.json());

// YouTube検索APIエンドポイント
app.get('/api/search', async (req, res) => {
  try {
    const { query, maxResults = 10 } = req.query;
    
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

// 動画分析APIエンドポイント
app.post('/api/analyze-video', async (req, res) => {
  try {
    const { videoId, theme, level } = req.body;
    
    // YouTube Data APIを使用して動画の詳細情報を取得
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,contentDetails',
        id: videoId,
        key: YOUTUBE_API_KEY
      }
    }) ;
    
    if (!response.data || !response.data.items || response.data.items.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    const videoInfo = response.data.items[0];
    const title = videoInfo.snippet.title;
    const description = videoInfo.snippet.description;
    const duration = parseDuration(videoInfo.contentDetails.duration); // ISO 8601形式の期間を秒に変換
    
    // OpenAI APIを使用してテキストベースの分析を行う
    const segments = await analyzeVideoContent(title, description, theme, level, duration);
    
    // 結果を返す
    res.json({ 
      videoId,
      title,
      duration,
      segments
    });
  } catch (error) {
    console.error('Error analyzing video:', error);
    res.status(500).json({ 
      error: 'Failed to analyze video',
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

// ISO 8601形式の期間を秒に変換する関数
function parseDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  
  const hours = (match[1] && match[1].replace('H', '')) || 0;
  const minutes = (match[2] && match[2].replace('M', '')) || 0;
  const seconds = (match[3] && match[3].replace('S', '')) || 0;
  
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
}

// テキストベースの動画内容分析
async function analyzeVideoContent(title, description, theme, level, duration) {
  const levelDescription = {
    'beginner': '初心者向けの基本的な内容',
    'intermediate': '中級者向けの応用的な内容',
    'expert': '専門家向けの高度な内容'
  };
  
  const prompt = `
以下はYouTube動画のタイトルと説明文です。この情報から、「${theme}」に関連する部分を特定し、動画内のどの部分（時間）が最も関連性が高いか推測してください。
動画の長さは${duration}秒（${Math.floor(duration/60)}分${duration%60}秒）です。

タイトル: ${title}
説明文: ${description}

この動画の中で、${levelDescription[level]}として「${theme}」に関連する部分を3つのセグメントに分けて特定してください。
各セグメントについて以下の情報を含めてください：
1. 開始時間（秒）- 推測で構いませんが、動画の長さ内に収めてください
2. 終了時間（秒）- 推測で構いませんが、動画の長さ内に収めてください
3. 関連度（0-1の数値）
4. セグメントの要約
5. レベル適合度（0-1の数値、${level}レベルにどれだけ適しているか）

結果は以下のJSON形式で返してください：
{
  "segments": [
    {
      "startTime": 開始時間（秒）,
      "endTime": 終了時間（秒）,
      "relevance": 関連度,
      "summary": "セグメントの要約",
      "levelFit": レベル適合度
    },
    ...
  ]
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.segments || [];
  } catch (error) {
    console.error('Error in OpenAI API call:', error);
    // 失敗した場合は簡易的なセグメントを返す
    return [
      {
        startTime: 0,
        endTime: Math.min(120, duration),
        relevance: 0.8,
        summary: `「${theme}」に関連する内容（推測）`,
        levelFit: 0.7
      }
    ];
  }
}

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
