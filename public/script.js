// グローバル変数
let player;
let currentPlaylist = [];
let currentIndex = 0;

// YouTube IFrame Player APIの読み込み完了時に呼ばれる関数
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '360',
    width: '640',
    videoId: '',
    playerVars: {
      'playsinline': 1,
      'autoplay': 0,
      'controls': 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

// プレーヤーの準備完了時に呼ばれる関数
function onPlayerReady(event) {
  console.log('Player ready');
  document.getElementById('search-button').addEventListener('click', searchVideos);
  document.getElementById('prev-button').addEventListener('click', playPrevious);
  document.getElementById('next-button').addEventListener('click', playNext);
}

// プレーヤーの状態変化時に呼ばれる関数
function onPlayerStateChange(event) {
  // 動画が終了したら次の動画を再生
  if (event.data === YT.PlayerState.ENDED) {
    playNext();
  }
}

// 動画を検索する関数
async function searchVideos() {
  const theme = document.getElementById('theme-input').value;
  const level = document.getElementById('level-select').value;
  const duration = document.getElementById('duration-select').value;
  
  if (!theme) {
    alert('テーマを入力してください');
    return;
  }
  
  // 検索中の表示
  document.getElementById('playlist').innerHTML = '<div class="loading">検索中...</div>';
  document.getElementById('summary').innerHTML = '<div class="loading">分析中...</div>';
  document.getElementById('related-topics').innerHTML = '';
  
  try {
    // APIリクエスト
    const response = await fetch(`/api/search?query=${encodeURIComponent(theme)}&level=${encodeURIComponent(level)}&duration=${encodeURIComponent(duration)}`);
    const data = await response.json();
    
    if (data.length === 0) {
      document.getElementById('playlist').innerHTML = '<div class="loading">該当する動画が見つかりませんでした</div>';
      document.getElementById('summary').innerHTML = '';
      return;
    }
    
    // プレイリストを作成
    createPlaylist(data, theme);
    
    // 最初の動画を再生
    playVideo(0);
    
    // 関連トピックを表示
    displayRelatedTopics(data);
  } catch (error) {
    console.error('Error searching videos:', error);
    document.getElementById('playlist').innerHTML = '<div class="loading">エラーが発生しました</div>';
    document.getElementById('summary').innerHTML = '';
  }
}

// プレイリストを作成する関数
function createPlaylist(videos, theme) {
  currentPlaylist = videos;
  currentIndex = 0;
  
  const playlistElement = document.getElementById('playlist');
  playlistElement.innerHTML = '';
  
  videos.forEach((video, index) => {
    const segment = video.currentSegment;
    const startTime = formatTime(segment.startTime);
    const endTime = formatTime(segment.endTime);
    
    const listItem = document.createElement('li');
    listItem.className = 'playlist-item';
    listItem.dataset.index = index;
    listItem.innerHTML = `
      <div class="playlist-item-title">${video.snippet.title}</div>
      <div class="playlist-item-time">${startTime} - ${endTime}</div>
    `;
    
    listItem.addEventListener('click', () => {
      playVideo(index);
    });
    
    playlistElement.appendChild(listItem);
  });
  
  // ナビゲーションボタンの状態を更新
  updateNavigationButtons();
}

// 動画を再生する関数
function playVideo(index) {
  if (index < 0 || index >= currentPlaylist.length) {
    return;
  }
  
  currentIndex = index;
  const video = currentPlaylist[index];
  const segment = video.currentSegment;
  
  // プレイリストのアクティブ項目を更新
  const playlistItems = document.querySelectorAll('.playlist-item');
  playlistItems.forEach(item => {
    item.classList.remove('active');
  });
  
  if (playlistItems[index]) {
    playlistItems[index].classList.add('active');
    playlistItems[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  
  // 動画を再生
  player.loadVideoById({
    videoId: video.id,
    startSeconds: segment.startTime,
    endSeconds: segment.endTime
  });
  
  // 要約と解説を表示
  displaySummary(video);
  
  // ナビゲーションボタンの状態を更新
  updateNavigationButtons();
}

// 前の動画を再生する関数
function playPrevious() {
  playVideo(currentIndex - 1);
}

// 次の動画を再生する関数
function playNext() {
  playVideo(currentIndex + 1);
}

// ナビゲーションボタンの状態を更新する関数
function updateNavigationButtons() {
  const prevButton = document.getElementById('prev-button');
  const nextButton = document.getElementById('next-button');
  
  prevButton.disabled = currentIndex <= 0;
  nextButton.disabled = currentIndex >= currentPlaylist.length - 1;
}

// 要約と解説を表示する関数
function displaySummary(video) {
  const summaryElement = document.getElementById('summary');
  
  if (video.analysis && video.analysis.summary) {
    summaryElement.innerHTML = `
      <h3>${video.snippet.title}</h3>
      <p>${video.analysis.summary}</p>
    `;
  } else {
    summaryElement.innerHTML = `
      <h3>${video.snippet.title}</h3>
      <p>${video.snippet.description}</p>
    `;
  }
}

// 関連トピックを表示する関数
function displayRelatedTopics(videos) {
  const relatedTopicsElement = document.getElementById('related-topics');
  relatedTopicsElement.innerHTML = '';
  
  // 全ての動画から関連トピックを収集
  const allTopics = new Set();
  videos.forEach(video => {
    if (video.analysis && video.analysis.relatedTopics) {
      video.analysis.relatedTopics.forEach(topic => {
        allTopics.add(topic);
      });
    }
  });
  
  // 関連トピックを表示
  if (allTopics.size > 0) {
    Array.from(allTopics).forEach(topic => {
      const listItem = document.createElement('li');
      listItem.textContent = topic;
      listItem.addEventListener('click', () => {
        document.getElementById('theme-input').value = topic;
        searchVideos();
      });
      relatedTopicsElement.appendChild(listItem);
    });
  } else {
    relatedTopicsElement.innerHTML = '<div class="loading">関連トピックがありません</div>';
  }
}

// 秒数を MM:SS 形式にフォーマットする関数
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
  // 検索ボタンのイベントリスナー（プレーヤーが準備できる前に設定）
  document.getElementById('search-button').addEventListener('click', searchVideos);
  
  // Enterキーでの検索
  document.getElementById('theme-input').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      searchVideos();
    }
  });
});
