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
    })  ;
    
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
    console.log(`Analyzing video ${videoId} for theme "${theme}" at level "${level}"`);
    
    // YouTube Data APIを使用して動画の詳細情報を取得
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,contentDetails',
        id: videoId,
        key: YOUTUBE_API_KEY
      }
    })  ;
    
    if (!response.data || !response.data.items || response.data.items.length === 0) {
      console.log(`Video ${videoId} not found`);
      return res.status(404).json({ error: 'Video not found' });
    }
    
    const videoInfo = response.data.items[0];
    const title = videoInfo.snippet.title;
    const description = videoInfo.snippet.description;
    const duration = parseDuration(videoInfo.contentDetails.duration); // ISO 8601形式の期間を秒に変換
    
    console.log(`Video info retrieved: "${title}", duration: ${duration}s`);
    
    // OpenAI APIを使用してテキストベースの分析を行う
    const segments = await analyzeVideoContent(title, description, theme, level, duration);
    
    console.log(`Analysis complete for ${videoId}, found ${segments.length} segments`);
    
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
    })  ;
    
    // 動画情報を返す
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching video details:', error);
    res.status(500).json({ error: 'Failed to fetch video details' });
  }
});

// 要約生成APIエンドポイント
app.post('/api/generate-summary', async (req, res) => {
  try {
    const { theme, level, videoData } = req.body;
    
    if (!theme || !level || !videoData) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // レベルに応じたテキスト
    const levelText = level === 'beginner' ? 'ビギナー' : 
                      level === 'intermediate' ? '中級者' : '専門家';
    
    // 動画情報のテキスト化
    const videoInfoText = videoData.map(video => 
      `タイトル: ${video.title}\n説明: ${video.description}`
    ).join('\n\n');
    
    // OpenAI APIへのプロンプト作成
    const prompt = `
あなたは教育コンテンツの専門家です。以下の情報を基に、テーマに関する詳細な要約と学習ガイドを作成してください。

テーマ: ${theme}
ユーザーレベル: ${levelText}
関連動画:
${videoInfoText}

以下の4つのセクションを含む要約を作成してください：

1. テーマの詳細解説（200-300文字）:
   テーマの基本的な説明、重要性、背景情報を${levelText}に適した深さで解説してください。

2. 主要な学習ポイント（3-5項目）:
   このテーマについて学ぶ際の重要なポイントを箇条書きでリストアップしてください。

3. 関連キーワード（3-5語）:
   テーマに関連する重要な用語や概念とその簡潔な説明を提供してください。

4. ${levelText}向け学習ロードマップ（3-5ステップ）:
   このテーマを学ぶための段階的なアプローチを提案してください。

回答は以下のJSON形式で提供してください：
{
  "themeExplanation": "テーマの詳細解説",
  "learningPoints": ["ポイント1", "ポイント2", "ポイント3"],
  "keywords": [
    {
      "term": "キーワード1",
      "explanation": "説明1"
    }
  ],
  "roadmap": ["ステップ1", "ステップ2", "ステップ3"]
}
`;

    // OpenAI APIを呼び出し
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "あなたは教育コンテンツの専門家です。JSON形式で回答してください。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    // APIレスポンスからコンテンツを取得
    const responseContent = completion.choices[0].message.content;
    
    // JSONレスポンスの抽出（正規表現を使用）
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    let summaryData;
    
    if (jsonMatch) {
      try {
        summaryData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Error parsing JSON from OpenAI response:', parseError);
        // フォールバック: シンプルな要約を生成
        summaryData = generateFallbackSummary(theme, level, videoData);
      }
    } else {
      // JSONが見つからない場合のフォールバック
      summaryData = generateFallbackSummary(theme, level, videoData);
    }
    
    // HTML形式の要約を生成
    const htmlSummary = generateHtmlSummary(summaryData, theme, levelText);
    
    // レスポンスを返す
    res.json({
      ...summaryData,
      html: htmlSummary
    });
    
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ 
      error: 'Failed to generate summary',
      message: error.message
    });
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
  
  // より明確なプロンプトを作成
  const prompt = `
あなたはYouTube動画の内容分析の専門家です。以下の動画情報から、「${theme}」に関連する部分を特定してください。
動画の長さは${duration}秒（${Math.floor(duration/60)}分${duration%60}秒）です。

タイトル: ${title}
説明文: ${description}

この動画の中で、${levelDescription[level]}として「${theme}」に関連する部分を3つのセグメントに分けて特定してください。
各セグメントは異なる時間帯にしてください。重複するセグメントは避けてください。

各セグメントについて以下の情報を含めてください：
1. 開始時間（秒）- 動画の長さ内に収めてください
2. 終了時間（秒）- 開始時間より後で、動画の長さ内に収めてください
3. 関連度（0-1の数値）- ${level}レベルでの「${theme}」との関連性
4. セグメントの要約 - 推測される内容の簡潔な説明
5. レベル適合度（0-1の数値）- ${level}レベルにどれだけ適しているか

重要な制約:
- 各セグメントは少なくとも30秒以上の長さにしてください
- 各セグメントの時間は互いに重複しないようにしてください
- 開始時間と終了時間は動画の長さ（${duration}秒）以内にしてください
- 難易度「${level}」に合わせた分析を行ってください
- 関連度が0.7未満のセグメントは含めないでください

結果は以下のJSON形式で返してください（必ずJSON形式を守ってください）：
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
    console.log('Sending request to OpenAI API...');
    
    // response_formatパラメータを削除し、代わりにプロンプトでJSON形式を指定
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // 標準モデルを使用
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7 // 多様性を持たせる
    });
    
    console.log('OpenAI API response received');
    
    const content = response.choices[0].message.content;
    console.log('Response content:', content);
    
    try {
      // JSONの部分を抽出するための正規表現
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : '{"segments":[]}';
      
      const parsed = JSON.parse(jsonString);
      
      // セグメントの検証と修正
      if (parsed.segments && Array.isArray(parsed.segments)) {
        // 各セグメントを検証
        const validSegments = parsed.segments.map(segment => {
          // 開始時間と終了時間が適切な範囲内にあるか確認
          const startTime = Math.max(0, Math.min(duration - 30, parseInt(segment.startTime) || 0));
          const endTime = Math.max(startTime + 30, Math.min(duration, parseInt(segment.endTime) || (startTime + 120)));
          
          // 関連度と適合度が0-1の範囲内にあるか確認
          const relevance = Math.max(0, Math.min(1, parseFloat(segment.relevance) || Math.random() * 0.5 + 0.5));
          const levelFit = Math.max(0, Math.min(1, parseFloat(segment.levelFit) || Math.random() * 0.5 + 0.5));
          
          return {
            startTime,
            endTime,
            relevance,
            summary: segment.summary || `「${theme}」に関連する内容（推測）`,
            levelFit
          };
        });
        
        // 重複するセグメントを除去
        const nonOverlappingSegments = [];
        validSegments.sort((a, b) => a.startTime - b.startTime); // 開始時間でソート
        
        for (const segment of validSegments) {
          // 既存のセグメントと重複しないか確認
          const overlaps = nonOverlappingSegments.some(existing => 
            (segment.startTime >= existing.startTime && segment.startTime < existing.endTime) ||
            (segment.endTime > existing.startTime && segment.endTime <= existing.endTime) ||
            (segment.startTime <= existing.startTime && segment.endTime >= existing.endTime)
          );
          
          // 重複しない場合のみ追加
          if (!overlaps) {
            nonOverlappingSegments.push(segment);
          }
        }
        
        // レベルに応じて適合度を調整
        return nonOverlappingSegments.map(segment => {
          let adjustedLevelFit = segment.levelFit;
          
          // レベルに応じた調整
          if (level === 'beginner') {
            adjustedLevelFit = Math.min(1, segment.levelFit * 1.2); // 初心者向けの適合度を上げる
          } else if (level === 'expert') {
            adjustedLevelFit = Math.min(1, segment.levelFit * 1.2); // 専門家向けの適合度を上げる
          }
          
          return {
            ...segment,
            levelFit: adjustedLevelFit
          };
        });
      }
      
      throw new Error('Invalid segments format');
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      throw parseError;
    }
  } catch (error) {
    console.error('Error in OpenAI API call:', error);
    
    // フォールバック: レベルと動画の長さに応じて異なるセグメントを生成
    const segmentCount = 3;
    const segmentLength = Math.min(120, Math.floor(duration / segmentCount));
    
    // レベルごとに異なるセグメントを生成
    return Array.from({ length: segmentCount }, (_, i) => {
      // レベルに応じて開始時間を変える（多様性を持たせる）
      let startOffset = 0;
      if (level === 'beginner') {
        startOffset = i * 10; // 初心者は序盤に集中
      } else if (level === 'intermediate') {
        startOffset = i * 20; // 中級者は中盤に分散
      } else {
        startOffset = i * 30; // 専門家は全体に分散
      }
      
      const startTime = Math.min(duration - 60, i * segmentLength + startOffset);
      const endTime = Math.min(duration, startTime + segmentLength);
      
      // レベルに応じて関連度と適合度を変える
      let relevance, levelFit;
      
      if (level === 'beginner') {
        relevance = 0.7 + (Math.random() * 0.2);
        levelFit = 0.8 + (Math.random() * 0.2);
      } else if (level === 'intermediate') {
        relevance = 0.6 + (Math.random() * 0.3);
        levelFit = 0.6 + (Math.random() * 0.3);
      } else { // expert
        relevance = 0.5 + (Math.random() * 0.4);
        levelFit = 0.7 + (Math.random() * 0.3);
      }
      
      return {
        startTime,
        endTime,
        relevance,
        summary: `「${theme}」に関する${levelDescription[level]}（セグメント ${i+1}）`,
        levelFit
      };
    });
  }
}

// フォールバック要約生成関数
function generateFallbackSummary(theme, level, videoData) {
  const levelText = level === 'beginner' ? 'ビギナー' : 
                    level === 'intermediate' ? '中級者' : '専門家';
  
  return {
    themeExplanation: `「${theme}」は重要なトピックです。このテーマについて学ぶことで、${levelText}として必要な知識を得ることができます。`,
    learningPoints: [
      `${theme}の基本概念を理解する`,
      `${theme}の実践的な応用方法を学ぶ`,
      `${theme}に関連する最新の動向を把握する`
    ],
    keywords: [
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
