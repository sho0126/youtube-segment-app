// YouTube Player APIの変数
let player;
let currentPlaylist = [];
let currentIndex = 0;

// YouTube IFrame Player APIの準備
function onYouTubeIframeAPIReady()  {
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
  // 動画が終了したら次の動画へ
  if (event.data === YT.PlayerState.ENDED) {
    playNextSegment();
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
    const response = await fetch(`/api/search?query=${encodeURIComponent(theme)}&maxResults=5`);
    const data = await response.json();
    
    // 検索結果から再生リストを作成
    // data.itemsが存在するか確認
    if (data && data.items && Array.isArray(data.items)) {
      createPlaylist(data.items, theme);
    } else {
      console.error('Invalid response format:', data);
      alert('検索結果のフォーマットが無効です');
      document.getElementById('summary').textContent = 'エラーが発生しました。もう一度お試しください。';
    }
    
    // 検索完了後、ローディング表示を非表示
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  } catch (error) {
    console.error('Error searching videos:', error);
    alert('動画の検索中にエラーが発生しました: ' + error.message);
    document.getElementById('summary').textContent = 'エラーが発生しました。もう一度お試しください。';
    
    // エラー時もローディング表示を非表示
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  }
}

// 再生リストを作成する関数
function createPlaylist(videos, theme) {
  currentPlaylist = [];
  currentIndex = 0;
  
  // 各動画から簡易的なセグメントを作成
  videos.forEach(video => {
    // videoとvideo.idが存在するか確認
    if (!video || !video.id || !video.id.videoId) {
      console.warn('Invalid video object:', video);
      return; // この動画をスキップ
    }
    
    const videoId = video.id.videoId;
    const title = video.snippet ? video.snippet.title : 'タイトルなし';
    const description = video.snippet ? video.snippet.description : '';
    
    // テーマとの関連性を簡易的に判断（実際はもっと複雑なロジックが必要）
    const isRelevant = title.toLowerCase().includes(theme.toLowerCase()) || 
                       description.toLowerCase().includes(theme.toLowerCase());
    
    if (isRelevant) {
      // 簡易的なセグメント（最初の2分間）
      currentPlaylist.push({
        videoId,
        title,
        startTime: 0,
        endTime: 120, // 2分間
        description
      });
    }
  });
  
  // 再生リストを表示
  displayPlaylist();
  
  // 関連テーマを表示
  displayRelatedThemes(theme);
  
  // 最初のセグメントを再生
  if (currentPlaylist.length > 0) {
    playCurrentSegment();
  } else {
    alert('関連する動画が見つかりませんでした');
    document.getElementById('summary').textContent = '関連する動画が見つかりませんでした。別のテーマで試してみてください。';
  }
}

// 再生リストを表示する関数
function displayPlaylist() {
  const playlistElement = document.getElementById('playlist');
  playlistElement.innerHTML = '';
  
  currentPlaylist.forEach((segment, index) => {
    const li = document.createElement('li');
    li.textContent = `${segment.title} (0:00 - ${Math.floor(segment.endTime / 60)}:${segment.endTime % 60 < 10 ? '0' + segment.endTime % 60 : segment.endTime % 60})`;
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
  
  // 簡易的な要約を表示
  const summaryElement = document.getElementById('summary');
  if (currentPlaylist.length > 0) {
    const level = document.getElementById('level-select').value;
    const levelText = level === 'beginner' ? 'ビギナー' : level === 'intermediate' ? '中級者' : '専門';
    
    summaryElement.textContent = `「${document.getElementById('theme-input').value}」に関連する${currentPlaylist.length}本の動画から${levelText}向けのセグメントを抽出しました。各動画の冒頭部分を再生します。`;
  } else {
    summaryElement.textContent = '';
  }
}

// 関連テーマを表示する関数
function displayRelatedThemes(theme) {
  const relatedThemesElement = document.getElementById('related-themes');
  if (!relatedThemesElement) return;
  
  // 関連テーマのリストを生成
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
    `${theme}の歴史`,
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
  if (currentIndex < currentPlaylist.length - 1) {
    currentIndex++;
    playCurrentSegment();
  } else {
    // 全てのセグメントが再生終了
    document.getElementById('summary').textContent += '\n\n全てのセグメントの再生が完了しました。';
  }
}

// エンターキーでの検索を有効化
document.getElementById('theme-input').addEventListener('keypress', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    searchVideos();
  }
});
