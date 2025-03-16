
import channels from './channels.js';

// Main application state
const appState = {
  isOn: true,
  volume: 1,
  currentChannel: 'trt1',
  channelInput: '',
  showChannelInfo: false,
  showVolume: false,
  showPreviewChannel: false,
  previewChannelId: null,
  showControls: true,
  showRemote: false,
  showChannelList: false,
  isToggling: false,
  isVideoPlaying: false,
  isFullscreen: false,
  channelTimeouts: []
};

// Initialize DOM Elements after document is loaded
let videoPlayer, staticOverlay, channelInfo, volumeInfo, remoteControl, 
    channelListEl, channelListContent, menuBtn, menuDropdown, 
    toggleRemoteBtn, toggleChannelsBtn, toggleFullscreenBtn, 
    fullscreenBtn, fullscreenIcon, powerBtn, volUpBtn, volDownBtn, 
    chUpBtn, chDownBtn, appContainer;

// Audio elements
const staticAudio = new Audio('https://www.soundjay.com/mechanical/sounds/tv-static-04.mp3');
staticAudio.loop = true;

// Initialize the app
function initApp() {
  // Get DOM elements after the document has loaded
  videoPlayer = document.getElementById('videoPlayer');
  staticOverlay = document.getElementById('static-overlay');
  channelInfo = document.getElementById('channel-info');
  volumeInfo = document.getElementById('volume-info');
  remoteControl = document.getElementById('remote-control');
  channelListEl = document.getElementById('channel-list');
  channelListContent = document.querySelector('.channel-list-content');
  menuBtn = document.getElementById('menu-btn');
  menuDropdown = document.getElementById('menu-dropdown');
  toggleRemoteBtn = document.getElementById('toggle-remote-btn');
  toggleChannelsBtn = document.getElementById('toggle-channels-btn');
  toggleFullscreenBtn = document.getElementById('toggle-fullscreen-btn');
  fullscreenBtn = document.getElementById('fullscreen-btn');
  fullscreenIcon = document.getElementById('fullscreen-icon');
  powerBtn = document.getElementById('power-btn');
  volUpBtn = document.getElementById('vol-up-btn');
  volDownBtn = document.getElementById('vol-down-btn');
  chUpBtn = document.getElementById('ch-up-btn');
  chDownBtn = document.getElementById('ch-down-btn');
  appContainer = document.getElementById('app');

  populateChannelList();
  attachEventListeners();
  switchToChannel(appState.currentChannel);
  updateVolumeDisplay();
}

// Populate the channel list
function populateChannelList() {
  if (!channelListContent) return;
  
  channelListContent.innerHTML = '';
  
  Object.entries(channels).forEach(([id, channel]) => {
    const channelItem = document.createElement('button');
    channelItem.className = 'channel-item';
    channelItem.textContent = `${channel.number}. ${channel.name}`;
    channelItem.onclick = () => switchToChannel(id);
    channelListContent.appendChild(channelItem);
  });
}

// Attach all event listeners
function attachEventListeners() {
  // Remote control buttons
  if (powerBtn) powerBtn.addEventListener('click', togglePower);
  
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => handleChannelInput(parseInt(btn.dataset.num)));
  });
  
  if (volUpBtn) volUpBtn.addEventListener('click', () => handleVolumeAdjust(0.1));
  if (volDownBtn) volDownBtn.addEventListener('click', () => handleVolumeAdjust(-0.1));
  if (chUpBtn) chUpBtn.addEventListener('click', () => handleChannelChange(-1));
  if (chDownBtn) chDownBtn.addEventListener('click', () => handleChannelChange(1));
  
  // Menu and UI controls
  if (menuBtn) menuBtn.addEventListener('click', toggleMenu);
  if (toggleRemoteBtn) toggleRemoteBtn.addEventListener('click', toggleRemote);
  if (toggleChannelsBtn) toggleChannelsBtn.addEventListener('click', toggleChannelList);
  if (toggleFullscreenBtn) toggleFullscreenBtn.addEventListener('click', toggleFullscreen);
  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
  
  // Close buttons
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const parent = e.target.closest('.remote-control, .channel-list');
      if (parent && parent.classList.contains('remote-control')) {
        toggleRemote();
      } else if (parent && parent.classList.contains('channel-list')) {
        toggleChannelList();
      }
    });
  });
  
  // Video player events
  if (videoPlayer) {
    videoPlayer.addEventListener('play', handleVideoPlaying);
    videoPlayer.addEventListener('error', handleError);
  }
  
  // Document events
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
}

// Video player related functions
function loadChannel(channelId) {
  const channel = channels[channelId];
  if (!channel || !appState.isOn || !videoPlayer) return;

  // Reset video
  videoPlayer.pause();
  videoPlayer.src = '';
  appState.isVideoPlaying = false;
  
  // Show loading state
  if (staticOverlay) staticOverlay.style.opacity = '1';
  
  if (channel.url.includes('.m3u8')) {
    loadHlsVideo(channel.url);
  } else if (channel.url.includes('.mpd')) {
    initShaka(channel.url, channel.key);
  } else {
    videoPlayer.src = channel.url;
    videoPlayer.play().catch(error => {
      console.error('Error playing video:', error);
      handleError();
    });
  }
}

function loadHlsVideo(url) {
  if (!videoPlayer) return;
  
  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(videoPlayer);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoPlayer.play().catch(error => {
        console.error('Error playing video:', error);
        handleError();
      });
    });
    
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        console.error('HLS error:', data);
        handleError();
      }
    });
  } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
    videoPlayer.src = url;
    videoPlayer.play().catch(error => {
      console.error('Error playing video:', error);
      handleError();
    });
  }
}

function initShaka(url, drmKey = null) {
  if (!window.shaka || !videoPlayer) {
    console.error('Shaka player not loaded or video player not found');
    handleError();
    return;
  }
  
  const player = new shaka.Player(videoPlayer);
  
  player.addEventListener('error', (error) => {
    console.error('Error loading video:', error);
    handleError();
  });
  
  if (drmKey) {
    player.configure({
      drm: {
        servers: {
          'com.widevine.alpha': drmKey
        }
      }
    });
  }
  
  player.load(url).then(() => {
    videoPlayer.play();
  }).catch(error => {
    console.error('Error loading video:', error);
    handleError();
  });
}

function handleVideoPlaying() {
  appState.isVideoPlaying = true;
  if (staticOverlay) staticOverlay.style.opacity = '0';
  if (staticAudio.played) {
    staticAudio.pause();
    staticAudio.currentTime = 0;
  }
}

function handleError() {
  console.error('Video playback error occurred');
  if (staticOverlay) staticOverlay.style.opacity = '1';
  if (appState.isOn && !appState.isVideoPlaying) {
    staticAudio.volume = appState.volume * 0.3;
    staticAudio.play().catch(console.error);
  }
}

// Channel functions
function switchToChannel(channelId) {
  if (!appState.isOn) return;
  
  appState.isVideoPlaying = false;
  appState.currentChannel = '';
  
  showChannelInfoForFiveSeconds(channelId);
  
  setTimeout(() => {
    appState.currentChannel = channelId;
    appState.channelInput = '';
    loadChannel(channelId);
  }, 50);
}

function showChannelInfoForFiveSeconds(channelId) {
  if (!appState.isOn) return;
  
  appState.showChannelInfo = true;
  appState.previewChannelId = channelId;
  appState.showPreviewChannel = true;
  
  // Clear any existing timeouts
  appState.channelTimeouts.forEach(id => clearTimeout(id));
  appState.channelTimeouts = [];
  
  // Update display
  updateChannelInfoDisplay();
  
  // Set timeout to hide
  const hideTimeout = setTimeout(() => {
    appState.showChannelInfo = false;
    appState.showPreviewChannel = false;
    updateChannelInfoDisplay();
  }, 5000);
  
  appState.channelTimeouts.push(hideTimeout);
}

function handleChannelInput(num) {
  if (!appState.isOn) return;
  
  const newInput = appState.channelInput + num;
  appState.channelInput = newInput;
  appState.showChannelInfo = true;
  appState.showPreviewChannel = false;
  
  // Clear any existing timeouts
  appState.channelTimeouts.forEach(id => clearTimeout(id));
  appState.channelTimeouts = [];
  
  // Update display
  updateChannelInfoDisplay();
  
  if (num >= 1 && num <= 9 && appState.channelInput === num.toString()) {
    const channelEntry = Object.entries(channels).find(([_, channel]) => 
      channel.number === num
    );
    
    if (channelEntry) {
      showChannelInfoForFiveSeconds(channelEntry[0]);
      
      const switchTimeout = setTimeout(() => {
        switchToChannel(channelEntry[0]);
      }, 1000);
      
      appState.channelTimeouts.push(switchTimeout);
      return;
    }
  }
  
  if (appState.channelInput.length >= 1) {
    const channelNumber = parseInt(newInput);
    const channelEntry = Object.entries(channels).find(([_, channel]) => 
      channel.number === channelNumber
    );
    
    if (channelEntry) {
      showChannelInfoForFiveSeconds(channelEntry[0]);
      
      const switchTimeout = setTimeout(() => {
        switchToChannel(channelEntry[0]);
      }, 1000);
      
      appState.channelTimeouts.push(switchTimeout);
    } else {
      const clearTimeout = setTimeout(() => {
        appState.channelInput = '';
        appState.showChannelInfo = false;
        updateChannelInfoDisplay();
      }, 1000);
      
      appState.channelTimeouts = [clearTimeout];
    }
  }
}

function handleChannelChange(direction) {
  if (!appState.isOn) return;
  
  const channelIds = Object.keys(channels);
  const currentIndex = channelIds.indexOf(appState.currentChannel);
  let nextIndex = currentIndex + direction;
  
  if (nextIndex < 0) nextIndex = channelIds.length - 1;
  if (nextIndex >= channelIds.length) nextIndex = 0;
  
  const nextChannelId = channelIds[nextIndex];
  
  setTimeout(() => {
    appState.isVideoPlaying = false;
  }, 50);
  
  appState.currentChannel = '';
  showChannelInfoForFiveSeconds(nextChannelId);
  
  setTimeout(() => {
    switchToChannel(nextChannelId);
  }, 50);
}

// Volume functions
function handleVolumeAdjust(change) {
  if (!appState.isOn || !videoPlayer) return;
  
  appState.volume = Math.max(0, Math.min(1, appState.volume + change));
  videoPlayer.volume = appState.volume;
  staticAudio.volume = appState.volume * 0.3;
  
  appState.showVolume = true;
  updateVolumeDisplay();
  
  setTimeout(() => {
    appState.showVolume = false;
    updateVolumeDisplay();
  }, 5000);
}

// UI display updates
function updateChannelInfoDisplay() {
  if (!channelInfo) return;
  
  // Channel input display
  if (appState.showChannelInfo && appState.channelInput) {
    channelInfo.innerHTML = `<div class="text-4xl mb-2 text-[#39FF14] font-arial font-bold uppercase">${appState.channelInput}</div>`;
    channelInfo.style.display = 'block';
  } 
  // Preview channel display
  else if (appState.showPreviewChannel && appState.previewChannelId) {
    const previewChannel = channels[appState.previewChannelId];
    if (previewChannel) {
      channelInfo.textContent = `${previewChannel.number}. ${previewChannel.name}`;
      channelInfo.style.display = 'block';
    }
  } 
  // Hide if nothing to show
  else {
    channelInfo.style.display = 'none';
  }
}

function updateVolumeDisplay() {
  if (!volumeInfo) return;
  
  if (appState.showVolume) {
    volumeInfo.textContent = `Vol: ${Math.round(appState.volume * 100)}%`;
    volumeInfo.style.display = 'block';
  } else {
    volumeInfo.style.display = 'none';
  }
}

// Power toggle function
function togglePower() {
  appState.isOn = !appState.isOn;
  
  if (!videoPlayer || !staticOverlay || !powerBtn) return;
  
  if (appState.isOn) {
    staticOverlay.style.opacity = '1';
    powerBtn.classList.remove('off');
    switchToChannel(appState.currentChannel);
  } else {
    videoPlayer.pause();
    videoPlayer.src = '';
    appState.isVideoPlaying = false;
    staticOverlay.style.opacity = '0';
    staticAudio.pause();
    staticAudio.currentTime = 0;
    powerBtn.classList.add('off');
    videoPlayer.style.display = 'none';
    setTimeout(() => {
      videoPlayer.style.display = 'block';
    }, 100);
  }
}

// UI control functions
function toggleMenu() {
  if (!menuDropdown || !menuBtn) return;
  
  menuDropdown.classList.toggle('hidden');
  
  document.addEventListener('click', function closeMenuOnClickOutside(e) {
    if ((!menuBtn.contains(e.target) && !menuDropdown.contains(e.target)) || !menuDropdown) {
      menuDropdown.classList.add('hidden');
      document.removeEventListener('click', closeMenuOnClickOutside);
    }
  });
}

function toggleControls() {
  appState.showControls = !appState.showControls;
  
  if (appState.showControls) {
    document.body.classList.remove('controls-hidden');
  } else {
    document.body.classList.add('controls-hidden');
    appState.showRemote = false;
    appState.showChannelList = false;
    if (remoteControl) remoteControl.classList.add('hidden');
    if (channelListEl) channelListEl.classList.add('hidden');
  }
}

function toggleRemote() {
  if (appState.isToggling || !remoteControl || !channelListEl) return;
  appState.isToggling = true;
  
  if (!appState.showRemote) {
    appState.showChannelList = false;
    channelListEl.classList.add('hidden');
  }
  
  appState.showRemote = !appState.showRemote;
  remoteControl.classList.toggle('hidden');
  appState.showControls = true;
  document.body.classList.remove('controls-hidden');
  
  setTimeout(() => {
    appState.isToggling = false;
  }, 300);
}

function toggleChannelList() {
  if (appState.isToggling || !channelListEl || !remoteControl) return;
  appState.isToggling = true;
  
  if (!appState.showChannelList) {
    appState.showRemote = false;
    remoteControl.classList.add('hidden');
  }
  
  appState.showChannelList = !appState.showChannelList;
  channelListEl.classList.toggle('hidden');
  appState.showControls = true;
  document.body.classList.remove('controls-hidden');
  
  setTimeout(() => {
    appState.isToggling = false;
  }, 300);
}

function toggleFullscreen() {
  if (!appContainer) return;
  
  if (!document.fullscreenElement) {
    appContainer.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

function handleFullscreenChange() {
  if (!fullscreenIcon || !toggleFullscreenBtn || !appContainer) return;
  
  appState.isFullscreen = !!document.fullscreenElement;
  
  if (appState.isFullscreen) {
    appContainer.classList.add('fullscreen');
    fullscreenIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 14 10 14 10 20"></polyline>
        <polyline points="20 10 14 10 14 4"></polyline>
        <line x1="14" y1="10" x2="21" y2="3"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      </svg>
    `;
    const span = toggleFullscreenBtn.querySelector('span');
    if (span) span.textContent = 'Exit Fullscreen';
  } else {
    appContainer.classList.remove('fullscreen');
    fullscreenIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
      </svg>
    `;
    const span = toggleFullscreenBtn.querySelector('span');
    if (span) span.textContent = 'Enter Fullscreen';
  }
}

// Event handlers
function handleKeyDown(e) {
  if (e.key === 'p') {
    togglePower();
  } else if (e.key === 'f') {
    toggleFullscreen();
  } else if (e.key === 'ArrowUp') {
    handleChannelChange(-1);
  } else if (e.key === 'ArrowDown') {
    handleChannelChange(1);
  } else if (e.key === 'ArrowLeft') {
    handleVolumeAdjust(-0.1);
  } else if (e.key === 'ArrowRight') {
    handleVolumeAdjust(0.1);
  } else if (!isNaN(Number(e.key)) && e.key !== ' ') {
    const num = parseInt(e.key);
    if (num >= 0 && num <= 9) {
      handleChannelInput(num);
    }
  } else if (e.key === 'm') {
    handleVolumeAdjust(appState.volume > 0 ? -appState.volume : 1);
  } else if (e.key === 'c') {
    toggleChannelList();
  } else if (e.key === 'r') {
    toggleRemote();
  } else if (e.key === 'Escape') {
    appState.showControls = false;
    appState.showRemote = false;
    appState.showChannelList = false;
    document.body.classList.add('controls-hidden');
    if (remoteControl) remoteControl.classList.add('hidden');
    if (channelListEl) channelListEl.classList.add('hidden');
  } else if (e.key === ' ') {
    toggleControls();
  }
}

function handleClickOutside(e) {
  if (!menuBtn || !menuDropdown || !remoteControl || !channelListEl) return;
  
  // Ignore if clicking menu elements
  if (menuBtn.contains(e.target) || menuDropdown.contains(e.target)) {
    return;
  }
  
  // Close remote if open and clicking outside
  if (appState.showRemote && !remoteControl.classList.contains('hidden') && !remoteControl.contains(e.target)) {
    toggleRemote();
  }
  
  // Close channel list if open and clicking outside
  if (appState.showChannelList && !channelListEl.classList.contains('hidden') && !channelListEl.contains(e.target)) {
    toggleChannelList();
  }
}

// Initialize the app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);
