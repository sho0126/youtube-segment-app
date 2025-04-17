// グローバル変数
let player;
let currentPlaylist = [];
let currentIndex = 0;
let isManualChange = false;
let playerReady = false;

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
  playerReady = true;
  console.log('Player ready');
  
  // 検索ボタンのイベントリスナー（プレーヤーが準備できた後に設定）
  document.getElementById('search-button').addEventListener('click', searchVideos);
  
  // ナビゲーションボタンのイベントリスナー
  document.getElementById('prev-button').addEventListener('click', playPrevious);
  document.getElementById('next-button').addEventListener('click', playNext);
  
  // Enterキーでの検索
  document.getElementById('theme-input').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      searchVideos();
    }
  });
}

// プレーヤーの状態変化時に呼ばれる関数
function onPlayerStateChange(event) {
  // 動画が終了したら次の動画を再生（手動変更でない場合のみ）
  if (event.data === YT.PlayerState.ENDED && !isManualChange) {
    console.log('Video ended, playing next');
    playNext();
  }
  
  // 再生中状態になったらフラグをリセット
  if (event.data === YT.PlayerState.PLAYING) {
    isManualChange = false;
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
  if (!playerReady || index < 0 || index >= currentPlaylist.length) {
    console.log(`Cannot play video: playerReady=${playerReady}, index=${index}, playlist length=${currentPlaylist.length}`);
    return;
  }
  
  isManualChange = true; // 手動変更フラグを設定
  currentIndex = index;
  const video = currentPlaylist[index];
  const segment = video.currentSegment || video.segments[0];
  
  console.log(`Playing video at index ${index}: ${video.snippet.title}`);
  console.log(`Segment: ${segment.startTime} - ${segment.endTime}`);
  
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

// 次の動画を再生する関数
function playNext() {
  const nextIndex = currentIndex + 1;
  if (nextIndex < currentPlaylist.length) {
    console.log(`Moving to next video: index ${nextIndex}`);
    playVideo(nextIndex);
  } else {
    console.log('Reached end of playlist');
  }
}

// 前の動画を再生する関数
function playPrevious() {
  const prevIndex = currentIndex - 1;
  if (prevIndex >= 0) {
    console.log(`Moving to previous video: index ${prevIndex}`);
    playVideo(prevIndex);
  } else {
    console.log('Already at beginning of playlist');
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
    // 現在のセグメントを設定
    video.currentSegment = video.segments[0];
    
    const segment = video.currentSegment;
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
      <div class="playlist-item-relevance">関連度: ${Math.round(segment.relevance * 100)}%</div>
    `;
    
    listItem.addEventListener('click', () => {
      console.log(`Playlist item clicked: index ${index}`);
      playVideo(index);
    });
    
    playlistElement.appendChild(listItem);
  });
  
  // 関連テーマの表示
  displayRelatedThemes(theme);
  
  // ナビゲーションボタンの状態を更新
  updateNavigationButtons();
  
  // 最初の動画を再生
  if (videos.length > 0) {
    console.log('Starting playlist with first video');
    setTimeout(() => {
      playVideo(0);
    }, 500); // 少し遅延させて確実にプレーヤーが準備できるようにする
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

// 関連テーマを表示する関数
function displayRelatedThemes(theme) {
  const relatedThemesElement = document.getElementById('related-themes');
  
  // 関連テーマのリストを生成（実際のアプリではAPIから取得）
  const relatedThemes = generateRelatedThemes(theme);
  
  let themesHTML = '<h3>関連テーマ</h3><ul>';
  relatedThemes.forEach(relatedTheme => {
    themesHTML += `<li><a href="#" onclick="setTheme('${relatedTheme}')">${relatedTheme}</a></li>`;
  });
  themesHTML += '</ul>';
  
  relatedThemesElement.innerHTML = themesHTML;
}

// 関連テーマを生成する関数（実際のアプリではAPIから取得）
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

// 時間を「分:秒」形式にフォーマットする関数
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 再生時間を秒に変換する関数
function getDurationInSeconds(duration) {
  switch (duration) {
    case '30min':
      return 30 * 60;
    case '1hour':
      return 60 * 60;
    case '2hours':
      return 120 * 60;
    default:
      return 30 * 60;
  }
}

// デバッグ情報表示関数
function showDebugInfo() {
  console.log('Current playlist:', currentPlaylist);
  console.log('Current index:', currentIndex);
  if (currentPlaylist[currentIndex]) {
    console.log('Current video:', currentPlaylist[currentIndex]);
  }
  console.log('Player ready:', playerReady);
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
  loadYouTubeAPI();
  
  // デバッグボタンの追加（開発時のみ）
  const debugButton = document.createElement('button');
  debugButton.textContent = 'Debug Info';
  debugButton.style.position = 'fixed';
  debugButton.style.bottom = '10px';
  debugButton.style.right = '10px';
  debugButton.style.zIndex = '1000';
  debugButton.addEventListener('click', showDebugInfo);
  document.body.appendChild(debugButton);
});
