// グローバル変数
let player;
let currentPlaylist = [];
let currentIndex = 0;

// YouTube IFrame Player APIの読み込み
function loadYouTubeAPI() {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script') [0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// YouTube Player APIが準備できたら呼ばれる関数
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '360',
    width: '640',
    videoId: '',
    playerVars: {
      'playsinline': 1,
      'enablejsapi': 1,
      'rel': 0
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

// プレーヤーの準備ができたら呼ばれる関数
function onPlayerReady(event) {
  console.log('Player ready');
  
  // 検索ボタンのイベントリスナー
  document.getElementById('search-button').addEventListener('click', searchVideos);
  
  // ナビゲーションボタンのイベントリスナー
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
  const themeInput = document.getElementById('theme-input').value;
  const levelSelect = document.getElementById('level-select').value;
  const durationSelect = document.getElementById('duration-select').value;
  
  if (!themeInput) {
    alert('テーマを入力してください');
    return;
  }
  
  try {
    document.getElementById('loading').style.display = 'block';
    
    // サーバーに検索リクエストを送信
    const response = await fetch(`/api/search?query=${encodeURIComponent(themeInput)}&level=${levelSelect}&duration=${durationSelect}`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    if (data.length === 0) {
      alert('検索結果が見つかりませんでした。別のテーマで試してください。');
      document.getElementById('loading').style.display = 'none';
      return;
    }
    
    // 検索結果を表示
    document.getElementById('results').style.display = 'block';
    document.getElementById('theme-display').textContent = themeInput;
    
    // プレイリストを作成
    createPlaylist(data, themeInput);
    
    document.getElementById('loading').style.display = 'none';
  } catch (error) {
    console.error('Error searching videos:', error);
    alert('検索中にエラーが発生しました: ' + error.message);
    document.getElementById('loading').style.display = 'none';
  }
}

// 動画を再生する関数
function playVideo(index) {
  if (index < 0 || index >= currentPlaylist.length) {
    return;
  }
  
  currentIndex = index;
  const video = currentPlaylist[index];
  const segment = video.segments[0];
  
  // プレイリストのアクティブ項目を更新
  const playlistItems = document.querySelectorAll('.playlist-item');
  playlistItems.forEach(item => {
    item.classList.remove('active');
  });
  
  if (playlistItems[index]) {
    playlistItems[index].classList.add('active');
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

// 次の動画を再生する関数
function playNext() {
  const nextIndex = currentIndex + 1;
  if (nextIndex < currentPlaylist.length) {
    playVideo(nextIndex);
  }
}

// 前の動画を再生する関数
function playPrevious() {
  const prevIndex = currentIndex - 1;
  if (prevIndex >= 0) {
    playVideo(prevIndex);
  }
}

// ナビゲーションボタンの状態を更新する関数
function updateNavigationButtons() {
  const prevButton = document.getElementById('prev-button');
  const nextButton = document.getElementById('next-button');
  
  prevButton.disabled = currentIndex <= 0;
  nextButton.disabled = currentIndex >= currentPlaylist.length - 1;
}

// プレイリストを作成する関数
function createPlaylist(videos, theme) {
  currentPlaylist = videos;
  currentIndex = 0;
  
  const playlistElement = document.getElementById('playlist');
  playlistElement.innerHTML = '';
  
  videos.forEach((video, index) => {
    const segment = video.segments[0];
    const startTime = formatTime(segment.startTime);
    const endTime = formatTime(segment.endTime);
    
    const listItem = document.createElement('li');
    listItem.className = 'playlist-item';
    if (index === 0) {
      listItem.classList.add('active');
    }
    
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
  
  // 最初の動画を再生
  if (videos.length > 0) {
    setTimeout(() => {
      playVideo(0);
    }, 500);
  }
}

// 要約と解説を表示する関数
function displaySummary(video) {
  const summaryElement = document.getElementById('summary');
  const analysis = video.analysis || {};
  
  let summaryHTML = `
    <h3>動画の要約</h3>
    <p>${analysis.summary || '要約は利用できません。'}</p>
    <h3>解説</h3>
    <p>${analysis.explanation || '解説は利用できません。'}</p>
  `;
  
  summaryElement.innerHTML = summaryHTML;
}

// 時間を「分:秒」形式にフォーマットする関数
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
  loadYouTubeAPI();
  
  // Enterキーでの検索
  document.getElementById('theme-input').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      searchVideos();
    }
  });
});
