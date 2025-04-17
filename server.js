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
    });
    
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
    res.status(500).json({ error: 'Failed to search YouTube', message: error.message });
  }
});

// 動画詳細情報取得APIエンドポイント
app.get('/api/video/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,contentDetails',
        id,
        key: YOUTUBE_API_KEY
      }
    });
    
    if (!response.data || !response.data.items || response.data.items.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    const video = response.data.items[0];
    
    // ISO 8601形式の期間を秒数に変換
    const duration = parseDuration(video.contentDetails.duration);
    
    res.json({
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      duration
    });
  } catch (error) {
    console.error('Error fetching video details:', error);
    res.status(500).json({ error: 'Failed to fetch video details', message: error.message });
  }
});

// 動画分析APIエンドポイント
app.post('/api/analyze-video', async (req, res) => {
  try {
    const { videoId, theme, level } = req.body;
    
    // 動画の詳細情報を取得
    const videoResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,contentDetails',
        id: videoId,
        key: YOUTUBE_API_KEY
      }
    });
    
    if (!videoResponse.data || !videoResponse.data.items || videoResponse.data.items.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    const video = videoResponse.data.items[0];
    const title = video.snippet.title;
    const description = video.snippet.description;
    
    // ISO 8601形式の期間を秒数に変換
    const duration = parseDuration(video.contentDetails.duration);
    
    // 動画内容を分析
    const analysis = await analyzeVideoContent(title, description, theme, level, duration);
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing video:', error);
    res.status(500).json({ error: 'Failed to analyze video', message: error.message });
  }
});

// 要約生成APIエンドポイント
app.post('/api/generate-summary', async (req, res) => {
  try {
    const { theme, level, videoData } = req.body;
    
    if (!theme || !level || !videoData) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // レベルテキストの設定
    const levelText = level === 'beginner' ? '初心者' : level === 'intermediate' ? '中級者' : '専門家';
    
    // OpenAI APIを使用して要約を生成
    const prompt = `
あなたは教育コンテンツキュレーターです。以下のYouTube動画リストから「${theme}」というテーマについて${levelText}向けの要約レポートを作成してください。

動画リスト:
${videoData.map(video => `- ${video.title}: ${video.description.substring(0, 100)}...`).join('\n')}

以下の形式でレポートを作成してください：
1. テーマの詳細解説 - ${theme}とは何か、その重要性、背景情報
2. 主要な学習ポイント - ${theme}について学ぶ際の重要なポイント（箇条書きで5つ）
3. 関連キーワード - ${theme}に関連する重要な用語や概念とその簡単な説明（5つ）
4. ${levelText}向け学習ロードマップ - ${theme}を学ぶための順序立てたステップ（3〜5ステップ）

レポートは${levelText}向けに適切な難易度で作成してください。専門用語の使用は${level === 'beginner' ? '最小限に抑え、わかりやすく' : level === 'intermediate' ? '適度に取り入れ' : '積極的に取り入れ、詳細に'}説明してください。

レスポンスはJSON形式で返してください。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "あなたは教育コンテンツキュレーターです。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const content = completion.choices[0].message.content;
    
    try {
      // JSONの部分を抽出するための正規表現
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : null;
      
      if (jsonString) {
        const summaryData = JSON.parse(jsonString);
        
        // HTML形式の要約を生成
        const html = generateHtmlSummary(summaryData, theme, levelText);
        
        res.json({
          raw: summaryData,
          html
        });
      } else {
        // JSONが見つからない場合はフォールバック
        const fallbackSummary = generateFallbackSummary(theme, levelText);
        const html = generateHtmlSummary(fallbackSummary, theme, levelText);
        
        res.json({
          raw: fallbackSummary,
          html
        });
      }
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      
      // パース失敗時のフォールバック
      const fallbackSummary = generateFallbackSummary(theme, levelText);
      const html = generateHtmlSummary(fallbackSummary, theme, levelText);
      
      res.json({
        raw: fallbackSummary,
        html
      });
    }
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary', message: error.message });
  }
});

// ISO 8601形式の期間を秒数に変換する関数
function parseDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  
  const hours = (match[1] && match[1].replace('H', '')) || 0;
  const minutes = (match[2] && match[2].replace('M', '')) || 0;
  const seconds = (match[3] && match[3].replace('S', '')) || 0;
  
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
}

// 動画内容を分析する関数
async function analyzeVideoContent(title, description, theme, level, duration) {
  try {
    // レベルテキストの設定
    const levelText = level === 'beginner' ? '初心者' : level === 'intermediate' ? '中級者' : '専門家';
    
    // OpenAI APIを使用して動画内容を分析
    const prompt = `
あなたは動画コンテンツアナライザーです。以下の動画タイトルと説明文から、「${theme}」というテーマに関連するセグメント（部分）を特定してください。

動画タイトル: ${title}
動画説明文: ${description}
動画の長さ: ${duration}秒

この動画から「${theme}」に関連する最大3つのセグメントを特定し、各セグメントについて以下の情報を含めてください：
1. 開始時間（秒）- 必ず整数の秒数で指定してください（例：120）。動画の長さ内に収めてください。
2. 終了時間（秒）- 必ず整数の秒数で指定してください（例：180）。開始時間より後で、動画の長さ内に収めてください。
3. セグメントの要約 - そのセグメントで話されている内容の簡潔な要約
4. 関連度 - そのセグメントが「${theme}」というテーマにどれだけ関連しているか（0.0〜1.0の数値）
5. レベル適合度 - そのセグメントが${levelText}向けにどれだけ適しているか（0.0〜1.0の数値）

重要な制約:
- 開始時間と終了時間は必ず動画の長さ（${duration}秒）以内にしてください
- 各セグメントの長さは30秒〜3分程度にしてください
- 関連度とレベル適合度は0.0〜1.0の範囲で、小数点第1位まで指定してください
- 時間は必ず秒数のみで表記してください。「02:12」のような時間表記は使わないでください。
- 動画の内容が「${theme}」と全く関連がない場合は、空のセグメントリストを返してください

レスポンスは以下のJSON形式で返してください：
{
  "segments": [
    {
      "startTime": 開始時間（秒）,
      "endTime": 終了時間（秒）,
      "summary": "セグメントの要約",
      "relevance": 関連度（0.0〜1.0）,
      "levelFit": レベル適合度（0.0〜1.0）
    },
    ...
  ]
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "あなたは動画コンテンツアナライザーです。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const content = completion.choices[0].message.content;
    
    try {
      // JSONの部分を抽出するための正規表現
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : '{"segments":[]}';
      
      // 時間表記を秒数に変換する前処理を追加
      const preprocessedJsonString = jsonString.replace(
        /"(startTime|endTime)":\s*(\d+):(\d+)/g, 
        (match, key, minutes, seconds) => {
          const totalSeconds = parseInt(minutes) * 60 + parseInt(seconds);
          return `"${key}": ${totalSeconds}`;
        }
      );
      
      const parsed = JSON.parse(preprocessedJsonString);
      
      // セグメントの検証と修正
      const validSegments = parsed.segments.filter(segment => {
        // 開始時間と終了時間が有効か確認
        return (
          typeof segment.startTime === 'number' && 
          typeof segment.endTime === 'number' && 
          segment.startTime >= 0 && 
          segment.endTime > segment.startTime && 
          segment.endTime <= duration
        );
      });
      
      return {
        segments: validSegments
      };
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      return { segments: [] };
    }
  } catch (error) {
    console.error('Error analyzing video content:', error);
    return { segments: [] };
  }
}

// フォールバック要約生成関数
function generateFallbackSummary(theme, levelText) {
  return {
    themeExplanation: `${theme}は様々な分野で重要な概念です。このテーマについて学ぶことで、関連する知識や技術を習得できます。`,
    learningPoints: [
      `${theme}の基本概念を理解する`,
      `${theme}の実践的な応用方法を学ぶ`,
      `${theme}に関連する技術や手法を知る`,
      `${theme}の最新トレンドを把握する`,
      `${theme}を活用した問題解決方法を習得する`
    ],
    keywords: [
      {
        term: `${theme}の定義`,
        explanation: `${theme}とは何かを説明する基本的な概念`
      },
      {
        term: `${theme}の歴史`,
        explanation: `${theme}がどのように発展してきたかの経緯`
      },
      {
        term: `${theme}の応用`,
        explanation: `${theme}を実際に活用するための方法`
      },
      {
        term: `${theme}の基礎`,
        explanation: `${theme}を理解するための基本的な概念`
      },
      {
        term: `${theme}の応用`,
        explanation: `${theme}を実際に活用するための方法`
      }
    ],
    roadmap: [
      `${theme}の基本を学ぶ`,
      `実践的な例を通じて理解を深める`,
      `応用スキルを身につける`
    ]
  };
}

// HTML形式の要約生成関数
function generateHtmlSummary(summaryData, theme, levelText) {
  const { themeExplanation, learningPoints, keywords, roadmap } = summaryData;
  
  const learningPointsHtml = learningPoints.map(point => `<li>${point}</li>`).join('');
  const keywordsHtml = keywords.map(kw => `<div class="keyword"><strong>${kw.term}</strong>: ${kw.explanation}</div>`).join('');
  const roadmapHtml = roadmap.map(step => `<li>${step}</li>`).join('');
  
  return `
<div class="summary-section">
  <h3>テーマ「${theme}」の解説</h3>
  <p>${themeExplanation}</p>
</div>

<div class="summary-section">
  <h3>主要な学習ポイント</h3>
  <ul>
    ${learningPointsHtml}
  </ul>
</div>

<div class="summary-section">
  <h3>関連キーワード</h3>
  <div class="keywords">
    ${keywordsHtml}
  </div>
</div>

<div class="summary-section">
  <h3>${levelText}向け学習ロードマップ</h3>
  <ol>
    ${roadmapHtml}
  </ol>
</div>
`;
}

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
});
