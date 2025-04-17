// YouTube Player APIの変数
let player;
let currentPlaylist = [];
let currentIndex = 0;

// YouTube IFrame Player APIの準備
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '360',
    width: '640',
    playerVars: {
      'playsinline': 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

// プレイヤー準備完了時
function onPlayerReady(event) {
  console.log('Player ready');
}

// プレイヤーの状態変化時
function onPlayerStateChange(event) {
  // 動画が終了したら次の動画へ（ただし一度だけ）
  if (event.data === YT.PlayerState.ENDED) {
    // 現在の動画が最後のものでなければ次へ
    if (currentIndex < currentPlaylist.length - 1) {
      currentIndex++;
      playCurrentSegment();
    } else {
      // 全てのセグメントが再生終了
      document.getElementById('summary').innerHTML += '<p><strong>全てのセグメントの再生が完了しました。</strong></p>';
    }
  }
}

// 検索ボタンのイベントリスナー
document.getElementById('search-button').addEventListener('click', searchVideos);

// 動画を検索する関数
async function searchVideos() {
  const theme = document.getElementById('theme-input').value;
  const level = document.getElementById('level-select').value;
  const duration = document.getElementById('duration-select').value;
  
  if (!theme) {
    alert('テーマを入力してください');
    return;
  }
  
  try {
    // 検索中の表示
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'block';
    }
    
    document.getElementById('summary').textContent = '検索中...';
    
    // APIリクエスト
    const response = await fetch(`/api/search?query=${encodeURIComponent(theme)}&maxResults=10`);
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      document.getElementById('summary').textContent = '動画が見つかりませんでした。別のテーマで試してください。';
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      return;
    }
    
    // 再生リストを作成
    await createPlaylistWithDuration(data.items, theme, level, parseInt(duration));
    
    // ローディング表示を非表示
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  } catch (error) {
    console.error('Error searching videos:', error);
    document.getElementById('summary').textContent = 'エラーが発生しました。もう一度お試しください。';
    
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  }
}

// テーマに関連する動画を選別する関数
function filterVideosByTheme(videos, theme) {
  return videos.filter(video => {
    const title = video.snippet.title.toLowerCase();
    const description = video.snippet.description.toLowerCase();
    const themeWords = theme.toLowerCase().split(/\s+/);
    
    // テーマのキーワードが少なくとも1つ含まれているか確認
    return themeWords.some(word => 
      title.includes(word) || description.includes(word)
    );
  });
}

// 動画のレベル適合度を評価する関数
function evaluateVideoLevel(video, level) {
  if (!video || !video.snippet) return 0.5; // デフォルト値を返す
  
  const title = video.snippet.title || '';
  const description = video.snippet.description || '';
  const content = title + ' ' + description;
  
  // 初心者向けの単語（日本語と英語）
  const beginnerTerms = ['入門', '基礎', '初心者', '簡単', 'わかりやすい', '基本', '初級', 'はじめて',
                         'beginner', 'basic', 'introduction', 'easy', 'simple', 'fundamental'];
  
  // 中級者向けの単語（日本語と英語）
  const intermediateTerms = ['実践', '応用', 'テクニック', 'ノウハウ', '中級', '効率的', '改善',
                            'intermediate', 'practical', 'technique', 'efficient', 'improve'];
  
  // 上級者向けの単語（日本語と英語）
  const expertTerms = ['高度', '専門', '詳細', '上級', '最新', '研究', '最適化', '先端', '理論',
                      'advanced', 'expert', 'professional', 'detailed', 'optimization', 'theory'];
  
  // 単語の出現回数をカウント
  let beginnerCount = 0;
  let intermediateCount = 0;
  let expertCount = 0;
  
  beginnerTerms.forEach(term => {
    if (content.toLowerCase().includes(term.toLowerCase())) beginnerCount++;
  });
  
  intermediateTerms.forEach(term => {
    if (content.toLowerCase().includes(term.toLowerCase())) intermediateCount++;
  });
  
  expertTerms.forEach(term => {
    if (content.toLowerCase().includes(term.toLowerCase())) expertCount++;
  });
  
  // スコアの計算（単語の出現回数に基づく）
  let score = 0.5; // デフォルトは中間
  
  if (beginnerCount > intermediateCount && beginnerCount > expertCount) {
    score = 0.3; // 初心者向け
  } else if (expertCount > beginnerCount && expertCount > intermediateCount) {
    score = 0.8; // 専門家向け
  } else if (intermediateCount > 0) {
    score = 0.6; // 中級者向け
  }
  
  // レベルに応じた適合度を計算
  let levelFit = 0;
  
  if (level === 'beginner') {
    levelFit = 1 - score * 0.8; // スコアが低いほど初心者向け
  } else if (level === 'intermediate') {
    levelFit = 1 - Math.abs(score - 0.5) * 2; // 中間に近いほど中級者向け
  } else if (level === 'expert') {
    levelFit = score; // スコアが高いほど専門家向け
  }
  
  // 最低0.3の適合度を保証（完全に除外されないように）
  return Math.max(0.3, levelFit);
}

// 要約を生成する関数
async function generateSummary(theme, level, videos) {
  try {
    // 動画データの準備
    const videoData = videos.map(video => ({
      title: video.snippet.title,
      description: video.snippet.description,
      videoId: video.id.videoId
    }));
    
    // APIリクエスト
    const response = await fetch('/api/generate-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        theme,
        level,
        videoData
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate summary');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error generating summary:', error);
    return null;
  }
}

// 再生リスト作成関数
async function createPlaylistWithDuration(videos, theme, level, targetDurationSeconds) {
  currentPlaylist = [];
  currentIndex = 0;
  
  // テーマに関連する動画を選別（より厳密なフィルタリング）
  const filteredVideos = filterVideosByTheme(videos, theme);
  
  if (filteredVideos.length === 0) {
    alert('関連する動画が見つかりませんでした');
    document.getElementById('summary').textContent = '関連する動画が見つかりませんでした。別のテーマで試してみてください。';
    return;
  }
  
  // レベルに基づいて動画をソート
  const levelSortedVideos = [...filteredVideos].sort((a, b) => {
    const levelFitA = evaluateVideoLevel(a, level);
    const levelFitB = evaluateVideoLevel(b, level);
    return levelFitB - levelFitA; // レベル適合度の高い順
  });
  
  // 上位の動画を選択（レベルに最適な動画を優先）
  const selectedVideos = levelSortedVideos.slice(0, Math.min(5, levelSortedVideos.length));
  
  // ローディング表示
  document.getElementById('summary').textContent = '動画を分析中...これには数分かかる場合があります。';
  
  let totalDuration = 0;
  let analyzedVideos = 0;
  
  // 既に追加した動画IDを記録するセット
  const addedVideoIds = new Set();
  
  // 各動画を分析し、関連セグメントを抽出
  for (const video of selectedVideos) {
    // 目標時間に達したら終了
    if (totalDuration >= targetDurationSeconds) break;
    
    const videoId = video.id.videoId;
    
    // 既に追加済みの動画はスキップ
    if (addedVideoIds.has(videoId)) {
      analyzedVideos++;
      continue;
    }
    
    try {
      // 進捗状況を更新
      document.getElementById('summary').textContent = `動画を分析中...${analyzedVideos + 1}/${selectedVideos.length}`;
      
      // 動画分析APIを呼び出し
      const response = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoId,
          theme,
          level
        })
      });
      
      const data = await response.json();
      
      // 分析に失敗した場合はスキップ
      if (!data || !data.segments || data.segments.length === 0) {
        analyzedVideos++;
        continue;
      }
      
      // 関連度とレベル適合度の値でセグメントをソート
      data.segments.sort((a, b) => {
        const scoreA = a.relevance * a.levelFit;
        const scoreB = b.relevance * b.levelFit;
        return scoreB - scoreA;
      });
      
      // 最も関連度の高いセグメントを追加
      for (const segment of data.segments) {
        const segmentDuration = segment.endTime - segment.startTime;
        
        // 目標時間を超える場合はスキップ
        if (totalDuration + segmentDuration > targetDurationSeconds) {
          continue;
        }
        
        // 再生リストに追加
        currentPlaylist.push({
          videoId,
          title: video.snippet.title,
          startTime: segment.startTime,
          endTime: segment.endTime,
          description: segment.summary,
          relevance: segment.relevance,
          levelFit: segment.levelFit
        });
        
        totalDuration += segmentDuration;
        
        // 目標時間に達したら終了
        if (totalDuration >= targetDurationSeconds) break;
      }
      
      // 動画を追加済みとしてマーク
      addedVideoIds.add(videoId);
      analyzedVideos++;
      
    } catch (error) {
      console.error('Error analyzing video:', error);
      analyzedVideos++;
    }
  }
  
  // 最大5本の動画まで分析
  if (analyzedVideos >= 5) break;
  
  // 再生リストを表示
  displayPlaylist();
  
  // 関連テーマを表示
  displayRelatedThemes(theme);
  
  // 要約を生成して表示
  const summaryElement = document.getElementById('summary');
  
  // 基本的な要約を表示（APIレスポンス待ちの間）
  const levelText = level === 'beginner' ? '初心者' : level === 'intermediate' ? '中級者' : '専門家';
  
  // 実際の再生リスト時間を計算
  let totalPlaylistDuration = 0;
  currentPlaylist.forEach(segment => {
    totalPlaylistDuration += (segment.endTime - segment.startTime);
  });
  
  const totalMin = Math.floor(totalPlaylistDuration / 60);
  const totalSec = Math.round(totalPlaylistDuration % 60);
  
  summaryElement.textContent = `「${theme}」に関連する${currentPlaylist.length}個のセグメントから${levelText}向けの再生リストを作成しました。`;
  summaryElement.innerHTML += `<p>詳細な要約を生成中...</p>`;
  
  // OpenAI APIを使用して詳細な要約を生成
  if (currentPlaylist.length > 0) {
    try {
      const summaryData = await generateSummary(theme, level, selectedVideos);
      
      if (summaryData && summaryData.html) {
        // HTML形式の要約を表示
        summaryElement.innerHTML = summaryData.html;
      }
    } catch (error) {
      console.error('Error displaying summary:', error);
      // エラー時は基本的な要約のままにする
    }
  }
  
  // 最初のセグメントを再生
  if (currentPlaylist.length > 0) {
    playCurrentSegment();
  } else {
    alert('関連するセグメントが見つかりませんでした');
    document.getElementById('summary').textContent = '関連するセグメントが見つかりませんでした。別のテーマで試してみてください。';
  }
}

// 再生リストを表示する関数
function displayPlaylist() {
  const playlistElement = document.getElementById('playlist');
  playlistElement.innerHTML = '';
  
  currentPlaylist.forEach((segment, index) => {
    const li = document.createElement('li');
    
    // 開始・終了時間のフォーマット
    const startMin = Math.floor(segment.startTime / 60);
    const startSec = segment.startTime % 60;
    const endMin = Math.floor(segment.endTime / 60);
    const endSec = segment.endTime % 60;
    
    const timeText = `${startMin}:${startSec < 10 ? '0' + startSec : startSec} - ${endMin}:${endSec < 10 ? '0' + endSec : endSec}`;
    
    // 関連度と適合度の表示
    const relevanceText = segment.relevance ? `関連度: ${Math.round(segment.relevance * 100)}%` : '';
    const levelFitText = segment.levelFit ? `適合度: ${Math.round(segment.levelFit * 100)}%` : '';
    
    li.innerHTML = `
      <div class="playlist-item-time">${timeText}</div>
      <div class="playlist-item-meta">${relevanceText} ${levelFitText}</div>
      <div class="playlist-item-desc">${segment.description}</div>
    `;
    
    li.classList.add('playlist-item');
    if (index === currentIndex) {
      li.classList.add('current');
    }
    
    li.addEventListener('click', () => {
      currentIndex = index;
      playCurrentSegment();
    });
    
    playlistElement.appendChild(li);
  });
}

// 関連テーマを表示する関数
function displayRelatedThemes(theme) {
  const relatedThemesElement = document.getElementById('related-themes');
  if (!relatedThemesElement) return;
  
  const relatedThemes = generateRelatedThemes(theme);
  
  let themesHTML = '<ul>';
  
  relatedThemes.forEach(relatedTheme => {
    themesHTML += `<li><a href="#" onclick="setTheme('${relatedTheme}'); return false;">${relatedTheme}</a></li>`;
  });
  
  themesHTML += '</ul>';
  
  relatedThemesElement.innerHTML = themesHTML;
}

// 関連テーマを生成する関数
function generateRelatedThemes(theme) {
  // 簡易的な実装
  const themes = [
    `${theme}の基礎`,
    `${theme}の応用`,
    `${theme}の最新動向`,
    `${theme}と関連技術`
  ];
  
  return themes;
}

// テーマを設定する関数
function setTheme(theme) {
  document.getElementById('theme-input').value = theme;
  searchVideos();
}

// 現在のセグメントを再生する関数
function playCurrentSegment() {
  if (currentPlaylist.length === 0 || currentIndex >= currentPlaylist.length) {
    return;
  }
  
  const segment = currentPlaylist[currentIndex];
  player.loadVideoById({
    videoId: segment.videoId,
    startSeconds: segment.startTime,
    endSeconds: segment.endTime
  });
  
  // 再生リストの現在の項目をハイライト
  const items = document.querySelectorAll('.playlist-item');
  items.forEach((item, index) => {
    if (index === currentIndex) {
      item.classList.add('current');
    } else {
      item.classList.remove('current');
    }
  });
}

// 次のセグメントを再生する関数
function playNextSegment() {
  // 既に最後の動画を再生中かチェック
  if (currentIndex >= currentPlaylist.length - 1) {
    // 全てのセグメントが再生終了
    document.getElementById('summary').innerHTML += '<p><strong>全てのセグメントの再生が完了しました。</strong></p>';
    return;
  }
  
  // インデックスを増加させて次の動画を再生
  currentIndex++;
  playCurrentSegment();
}

// エンターキーでの検索を有効化
document.getElementById('theme-input').addEventListener('keypress', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    searchVideos();
  }
});
