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

// 必要なパッケージの追加
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

// OpenAI クライアントの初期化
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 一時ファイル保存ディレクトリ
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// 動画分析エンドポイント
app.post('/api/analyze-video', async (req, res) => {
  try {
    const { videoId, theme, level } = req.body;
    
    // 動画情報の取得
    const videoInfo = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`) ;
    const videoTitle = videoInfo.videoDetails.title;
    const videoDuration = parseInt(videoInfo.videoDetails.lengthSeconds);
    
    // 長すぎる動画は部分的に処理
    const maxDuration = 600; // 最大10分
    const processDuration = Math.min(videoDuration, maxDuration);
    
    // 音声の抽出
    const audioPath = path.join(tempDir, `${videoId}.mp3`);
    await extractAudio(videoId, audioPath, processDuration);
    
    // 音声の文字起こし
    const transcription = await transcribeAudio(audioPath);
    
    // 文字起こしの分割（長すぎる場合）
    const chunks = splitTranscription(transcription);
    
    // 各チャンクの分析とセグメント特定
    let allSegments = [];
    for (const chunk of chunks) {
      const segments = await identifyRelevantSegments(chunk, theme, level);
      allSegments = [...allSegments, ...segments];
    }
    
    // セグメントの時間調整と重複排除
    const finalSegments = processSegments(allSegments, videoDuration);
    
    // 一時ファイルの削除
    fs.unlinkSync(audioPath);
    
    // 結果を返す
    res.json({ 
      videoId,
      title: videoTitle,
      duration: videoDuration,
      segments: finalSegments
    });
  } catch (error) {
    console.error('Error analyzing video:', error);
    res.status(500).json({ 
      error: 'Failed to analyze video',
      message: error.message
    });
  }
});

// 音声抽出関数
function extractAudio(videoId, outputPath, duration) {
  return new Promise((resolve, reject) => {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const stream = ytdl(videoUrl, { quality: 'highestaudio' }) ;
    
    ffmpeg(stream)
      .audioBitrate(128)
      .toFormat('mp3')
      .duration(duration)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

// 音声文字起こし関数
async function transcribeAudio(audioPath) {
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1',
    language: 'ja'
  });
  return response.text;
}

// 文字起こしの分割（長すぎる場合）
function splitTranscription(transcription) {
  const maxChunkLength = 4000; // GPT-4の入力制限に合わせる
  const chunks = [];
  
  if (transcription.length <= maxChunkLength) {
    return [transcription];
  }
  
  // 文単位で分割
  const sentences = transcription.split(/(?<=[。．！？])/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkLength) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// 関連セグメント特定関数
async function identifyRelevantSegments(transcription, theme, level) {
  const levelDescription = {
    'beginner': '初心者向けの基本的な内容',
    'intermediate': '中級者向けの応用的な内容',
    'expert': '専門家向けの高度な内容'
  };
  
  const prompt = `
あなたは動画内容分析の専門家です。以下の文字起こしから、「${theme}」に関連する部分を特定してください。
特に${levelDescription[level]}に焦点を当ててください。

各セグメントについて以下の情報を含めてください：
1. 開始時間（秒）
2. 終了時間（秒）
3. 関連度（0-1の数値）
4. セグメントの要約
5. レベル適合度（0-1の数値、${level}レベルにどれだけ適しているか）

結果は以下のJSON形式で返してください：
[
  {
    "startTime": 開始時間（秒）,
    "endTime": 終了時間（秒）,
    "relevance": 関連度,
    "summary": "セグメントの要約",
    "levelFit": レベル適合度
  },
  ...
]

文字起こし：
${transcription}
`;

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
  
  try {
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.segments || [];
  } catch (error) {
    console.error('Error parsing GPT response:', error);
    return [];
  }
}

// セグメントの処理（時間調整と重複排除）
function processSegments(segments, videoDuration) {
  // 関連度でソート
  segments.sort((a, b) => b.relevance - a.relevance);
  
  // 重複排除（時間が重なるセグメントを統合）
  const mergedSegments = [];
  const usedTimeRanges = [];
  
  for (const segment of segments) {
    // 動画の長さを超えないように調整
    segment.endTime = Math.min(segment.endTime, videoDuration);
    
    // 既存の時間範囲と重複するかチェック
    const overlaps = usedTimeRanges.some(range => 
      (segment.startTime >= range.start && segment.startTime <= range.end) ||
      (segment.endTime >= range.start && segment.endTime <= range.end) ||
      (segment.startTime <= range.start && segment.endTime >= range.end)
    );
    
    if (!overlaps) {
      mergedSegments.push(segment);
      usedTimeRanges.push({
        start: segment.startTime,
        end: segment.endTime
      });
    }
  }
  
  return mergedSegments;
}
