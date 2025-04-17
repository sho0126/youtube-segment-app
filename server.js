require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// OpenAI APIクライアントの初期化
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// YouTube検索API
app.get('/api/search', async (req, res) => {
  try {
    const { query, level, duration } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'クエリパラメータが必要です' });
    }
    
    // YouTube Data APIを使用して動画を検索
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 10,
        key: YOUTUBE_API_KEY,
        relevanceLanguage: 'ja'
      }
    }) ;
    
    // 検索結果から動画IDを抽出
    const videoIds = response.data.items.map(item => item.id.videoId);
    
    // 動画の詳細情報を取得
    const videoDetailsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,contentDetails,statistics',
        id: videoIds.join(',') ,
        key: YOUTUBE_API_KEY
      }
    });
    
    // 動画情報を拡張
    const enhancedVideos = await enhanceVideosWithAI(videoDetailsResponse.data.items, query, level, duration);
    
    res.json(enhancedVideos);
  } catch (error) {
    console.error('Error searching videos:', error);
    res.status(500).json({ error: '動画の検索中にエラーが発生しました' });
  }
});

// 動画の字幕を取得するAPI
app.get('/api/captions/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    // 字幕トラックのリストを取得
    const captionListResponse = await axios.get('https://www.googleapis.com/youtube/v3/captions', {
      params: {
        part: 'snippet',
        videoId: videoId,
        key: YOUTUBE_API_KEY
      },
      headers: {
        Authorization: `Bearer ${process.env.YOUTUBE_ACCESS_TOKEN}` // 注: これには認証が必要
      }
    }) ;
    
    // 日本語または英語の字幕を優先
    const captions = captionListResponse.data.items;
    const jaCaption = captions.find(caption => caption.snippet.language === 'ja');
    const enCaption = captions.find(caption => caption.snippet.language === 'en');
    const targetCaption = jaCaption || enCaption || captions[0];
    
    if (!targetCaption) {
      return res.status(404).json({ error: '字幕が見つかりませんでした' });
    }
    
    // 字幕コンテンツを取得
    const captionResponse = await axios.get(`https://www.googleapis.com/youtube/v3/captions/${targetCaption.id}`, {
      params: {
        key: YOUTUBE_API_KEY
      },
      headers: {
        Authorization: `Bearer ${process.env.YOUTUBE_ACCESS_TOKEN}`
      }
    }) ;
    
    res.json(captionResponse.data);
  } catch (error) {
    console.error('Error fetching captions:', error);
    res.status(500).json({ error: '字幕の取得中にエラーが発生しました' });
  }
});

// 音声認識API
app.post('/api/transcribe', async (req, res) => {
  try {
    const { videoUrl } = req.body;
    
    // 動画から音声を抽出（実際の実装ではffmpegなどを使用）
    const audioBuffer = await extractAudioFromVideo(videoUrl);
    
    // Whisper APIで音声認識
    const transcription = await openai.audio.transcriptions.create({
      file: audioBuffer,
      model: 'whisper-1',
      language: 'ja'
    });
    
    res.json({ transcription: transcription.text });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    res.status(500).json({ error: '音声認識中にエラーが発生しました' });
  }
});

// コンテンツ分析API
app.post('/api/analyze', async (req, res) => {
  try {
    const { text, theme, level } = req.body;
    
    // GPT-4を使用してコンテンツを分析
    const analysis = await analyzeContentWithGPT(text, theme, level);
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing content:', error);
    res.status(500).json({ error: 'コンテンツ分析中にエラーが発生しました' });
  }
});

// OpenAIを使用して動画情報を拡張
async function enhanceVideosWithAI(videos, theme, level, duration) {
  try {
    // 各動画の情報を拡張
    const enhancedVideos = await Promise.all(videos.map(async (video) => {
      const title = video.snippet.title;
      const description = video.snippet.description;
      
      // タイトルと説明文を結合してGPT-4に分析させる
      const content = `タイトル: ${title}\n説明: ${description}`;
      const analysis = await analyzeContentWithGPT(content, theme, level);
      
      // 分析結果から関連セグメントを抽出
      return {
        ...video,
        analysis,
        segments: analysis.segments || [{
          startTime: 0,
          endTime: 120, // デフォルトは最初の2分間
          relevance: analysis.relevance || 0.5
        }]
      };
    }));
    
    // レベルでフィルタリング
    const filteredVideos = enhancedVideos.filter(video => {
      return video.analysis.levelMatch === true;
    });
    
    // 関連性でソート
    const sortedVideos = filteredVideos.sort((a, b) => {
      return b.analysis.relevance - a.analysis.relevance;
    });
    
    // 指定された再生時間に合わせてプレイリストを生成
    const durationInSeconds = getDurationInSeconds(duration);
    const playlist = generatePlaylist(sortedVideos, durationInSeconds);
    
    return playlist;
  } catch (error) {
    console.error('Error enhancing videos with AI:', error);
    return videos; // エラーが発生した場合は元の動画リストを返す
  }
}

// GPT-4を使用してコンテンツを分析
async function analyzeContentWithGPT(text, theme, level) {
  try {
    const prompt = `
あなたはYouTube動画の内容分析エキスパートです。以下の動画情報を分析し、テーマ「${theme}」との関連性を判断してください。

また、この動画が${level}レベルの視聴者に適しているかも判断してください。
- ビギナー: 基本的な概念や入門レベルの内容
- 中級者: 応用知識や実践的な内容
- 専門レベル: 高度な概念や最新の研究・技術

動画情報:
${text}

以下の形式でJSON形式で回答してください:
{
  "relevance": 0.0〜1.0の数値（テーマとの関連性）,
  "levelMatch": true/false（指定されたレベルに適しているか）,
  "summary": "動画の要約",
  "segments": [
    {
      "startTime": 開始時間（秒）,
      "endTime": 終了時間（秒）,
      "content": "セグメントの内容",
      "relevance": 0.0〜1.0の数値（テーマとの関連性）
    }
  ],
  "relatedTopics": ["関連トピック1", "関連トピック2"]
}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'あなたはYouTube動画の内容分析エキスパートです。' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });
    
    const analysisText = response.choices[0].message.content;
    return JSON.parse(analysisText);
  } catch (error) {
    console.error('Error analyzing content with GPT:', error);
    return {
      relevance: 0.5,
      levelMatch: true,
      summary: '分析できませんでした',
      segments: [],
      relatedTopics: []
    };
  }
}

// 動画から音声を抽出（実際の実装ではffmpegなどを使用）
async function extractAudioFromVideo(videoUrl) {
  // この関数は実際の実装では、ffmpegを使用して動画から音声を抽出します
  // ここではダミー実装
  return Buffer.from('dummy audio data');
}

// 再生時間の文字列を秒数に変換
function getDurationInSeconds(duration) {
  switch (duration) {
    case '30分':
      return 30 * 60;
    case '1時間':
      return 60 * 60;
    case '2時間':
      return 120 * 60;
    default:
      return 30 * 60; // デフォルトは30分
  }
}

// 指定された再生時間に合わせてプレイリストを生成
function generatePlaylist(videos, totalDurationInSeconds) {
  let currentDuration = 0;
  const playlist = [];
  
  for (const video of videos) {
    // 各動画のセグメントを処理
    for (const segment of video.segments) {
      const segmentDuration = segment.endTime - segment.startTime;
      
      if (currentDuration + segmentDuration <= totalDurationInSeconds) {
        playlist.push({
          ...video,
          currentSegment: segment
        });
        
        currentDuration += segmentDuration;
      }
      
      if (currentDuration >= totalDurationInSeconds) {
        break;
      }
    }
    
    if (currentDuration >= totalDurationInSeconds) {
      break;
    }
  }
  
  return playlist;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
