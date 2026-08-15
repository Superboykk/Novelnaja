// ==========================================================================
// KINDLE NOVEL READER - CORE APPLICATION
// ==========================================================================

// Global state
let novelsData = [];
let currentBook = null;
let currentChapterIndex = -1;
let userSettings = {};

const DEFAULT_SETTINGS = {
  theme: 'light',
  fontFamily: 'serif',
  fontSize: 'medium',
  width: 'medium',
  lineHeight: 'normal'
};

const FONT_SIZE_LABELS = {
  'xsmall': 'เล็กสุด (70%)',
  'small': 'เล็ก (85%)',
  'medium': 'ปกติ (100%)',
  'large': 'ใหญ่ (115%)',
  'xlarge': 'ใหญ่มาก (130%)',
  'huge': 'ใหญ่พิเศษ (150%)'
};

const FONT_SIZES = ['xsmall', 'small', 'medium', 'large', 'xlarge', 'huge'];

// DOM Elements
const body = document.body;
const viewLibrary = document.getElementById('library-view');
const viewReader = document.getElementById('reader-view');
const bookshelfGrid = document.getElementById('bookshelf-grid');
const searchInput = document.getElementById('search-input');
const btnBackLibrary = document.getElementById('btn-back-library');
const appTitle = document.getElementById('app-title');
const readerControls = document.getElementById('reader-controls');
const readingProgressBar = document.getElementById('reading-progress-bar');
const readingProgressContainer = document.getElementById('reading-progress-container');
const readerViewport = document.getElementById('reading-viewport');
const readerContent = document.getElementById('reader-content');

// Library Tabs & Support Elements
const tabLibrary = document.getElementById('tab-library');
const tabSupport = document.getElementById('tab-support');
const supportContainer = document.getElementById('support-container');
const searchSection = document.getElementById('search-section');

// Navigation buttons
const btnPrevChapter = document.getElementById('btn-prev-chapter');
const btnNextChapter = document.getElementById('btn-next-chapter');
const prevChapterTitle = document.getElementById('prev-chapter-title');
const nextChapterTitle = document.getElementById('next-chapter-title');

// Sidebar TOC
const btnToc = document.getElementById('btn-toc');
const btnFloatToc = document.getElementById('btn-float-toc');
const btnCloseToc = document.getElementById('btn-close-toc');
const readerToc = document.getElementById('reader-toc');
const tocList = document.getElementById('toc-list');

// Floating scroll-to-top
const btnFloatTop = document.getElementById('btn-float-top');

// Settings panel elements
const btnSettings = document.getElementById('btn-settings');
const settingsPopover = document.getElementById('settings-popover');
const btnCloseSettings = document.getElementById('btn-close-settings');
const themeButtons = document.querySelectorAll('.theme-opt');
const btnFontSerif = document.getElementById('btn-font-serif');
const btnFontSans = document.getElementById('btn-font-sans');
const btnSizeDec = document.getElementById('btn-size-dec');
const btnSizeInc = document.getElementById('btn-size-inc');
const currentSizeLabel = document.getElementById('current-size-label');
const widthButtons = document.querySelectorAll('.width-opt');
const lhButtons = document.querySelectorAll('.lh-opt');

// TTS DOM Elements
const btnTTS = document.getElementById('btn-tts');
const btnFloatTTS = document.getElementById('btn-float-tts');
const ttsPlayerBar = document.getElementById('tts-player-bar');
const btnTTSPlayPause = document.getElementById('btn-tts-play-pause');
const btnTTSStop = document.getElementById('btn-tts-stop');
const btnTTSPrev = document.getElementById('btn-tts-prev');
const btnTTSNext = document.getElementById('btn-tts-next');
const btnTTSClose = document.getElementById('btn-tts-close');
const ttsSpeedSelect = document.getElementById('tts-speed-select');
const ttsVoiceSelect = document.getElementById('tts-voice-select');
const ttsVoiceNotice = document.getElementById('tts-voice-notice');
const ttsProgressText = document.getElementById('tts-progress-text');
const ttsIconPlay = document.getElementById('tts-icon-play');
const ttsIconPause = document.getElementById('tts-icon-pause');

// ==========================================================================
// SERVICE WORKER REGISTRATION
// ==========================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service Worker registered with scope:', reg.scope))
      .catch(err => console.error('[PWA] Service Worker registration failed:', err));
  });
}

// ==========================================================================
// REGEX-BASED LIGHTWEIGHT MARKDOWN PARSER
// ==========================================================================
function parseMarkdown(md, bookSlug) {
  if (!md) return '';

  // 1. Normalize line endings
  let html = md.replace(/\r\n/g, '\n');

  // 2. Escape basic HTML tags to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 3. Image parser (Resolve relative paths dynamically)
  // Replaces: ![alt](url) -> <img src="novels/book-slug/url" alt="alt">
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
    let resolvedSrc = src.trim();
    // Prepend novel base directory if it's a relative local image path
    if (!resolvedSrc.startsWith('http://') && !resolvedSrc.startsWith('https://') && !resolvedSrc.startsWith('/')) {
      resolvedSrc = `novels/${bookSlug}/${resolvedSrc}`;
    }
    return `<img src="${resolvedSrc}" alt="${alt}" loading="lazy">`;
  });

  // 4. Headings
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');

  // 5. Horizontal Rules
  html = html.replace(/^---$/gim, '<hr>');
  html = html.replace(/^\*\*\*$/gim, '<hr>');

  // 6. Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // 7. Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // 8. Blockquotes
  html = html.replace(/^>\s+(.*)$/gim, '<blockquote>$1</blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // 9. Bullet Points & Lists
  html = html.replace(/^\s*[-*+]\s+(.*)$/gim, '<li>$1</li>');
  // Wrap list items in <ul>. Regex matches consecutive <li> tags
  html = html.replace(/(<li>.*<\/li>(?:\n<li>.*<\/li>)*)/g, '<ul>$1</ul>');

  // 10. Paragraphs and line breaks
  // Handle double space line breaks
  html = html.replace(/  \n/g, '<br>\n');

  // Split into blocks by double newlines
  const blocks = html.split(/\n{2,}/);
  html = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    // Skip wrapping block-level tags in <p>
    if (/^<(h1|h2|h3|hr|blockquote|ul|ol|li)/i.test(block)) {
      return block;
    }
    return `<p>${block.replace(/\n/g, ' ')}</p>`;
  }).join('\n');

  return html;
}

// ==========================================================================
// APPLICATION ROUTER (HASH ROUTING)
// ==========================================================================
function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute(); // Run once on startup
}

async function handleRoute() {
  const hash = window.location.hash || '#/';
  
  // Close popovers and sidebars on route changes
  body.classList.remove('toc-open');
  settingsPopover.classList.add('hidden');

  if (hash === '#/' || hash === '') {
    showLibraryView();
  } else if (hash.startsWith('#/book/')) {
    // Expected hash: #/book/:bookSlug/chapter/:chapterSlug
    const parts = hash.split('/');
    const bookSlug = decodeURIComponent(parts[2]);
    const chapterSlug = decodeURIComponent(parts[4]);

    if (bookSlug && chapterSlug) {
      await showReaderView(bookSlug, chapterSlug);
    } else {
      window.location.hash = '#/';
    }
  } else {
    window.location.hash = '#/';
  }
}

// ==========================================================================
// LIBRARY VIEW (BOOKSHELF RENDER & ACTIONS)
// ==========================================================================
function showLibraryView() {
  stopTTS();
  viewReader.classList.remove('active');
  viewReader.classList.add('hidden');
  viewLibrary.classList.add('active');
  btnBackLibrary.classList.add('hidden');
  appTitle.classList.remove('hidden');
  readerControls.classList.add('hidden');
  readingProgressContainer.classList.add('hidden');

  // Reset tab active state
  if (tabLibrary && tabSupport) {
    tabLibrary.classList.add('active');
    tabSupport.classList.remove('active');
    searchSection.classList.remove('hidden');
    bookshelfGrid.classList.remove('hidden');
    supportContainer.classList.add('hidden');
  }

  // Refresh Bookshelf grid to show updated reading progress bars
  renderBookshelf();
}

function renderBookshelf() {
  if (novelsData.length === 0) {
    bookshelfGrid.innerHTML = `
      <div class="loading-spinner">
        <p>ไม่พบนิยายในคลัง กรุณาเพิ่มนิยายในโฟลเดอร์ novels/</p>
      </div>
    `;
    return;
  }

  const query = searchInput.value.trim().toLowerCase();
  
  // Filter books by search query
  const filteredBooks = novelsData.filter(book => {
    return book.title.toLowerCase().includes(query) || 
           book.author.toLowerCase().includes(query) || 
           book.description.toLowerCase().includes(query);
  });

  if (filteredBooks.length === 0) {
    bookshelfGrid.innerHTML = `
      <div class="loading-spinner">
        <p>ไม่พบนิยายที่ตรงกับการค้นหา</p>
      </div>
    `;
    return;
  }

  bookshelfGrid.innerHTML = filteredBooks.map(book => {
    // Get saved progress from LocalStorage
    const progress = getBookProgress(book.slug);
    const progressPercent = progress ? Math.round(progress.percent * 100) : 0;
    
    // Determine active chapter description
    let progressLabel = 'ยังไม่ได้อ่าน';
    if (progress) {
      const activeChIndex = book.chapters.findIndex(c => c.slug === progress.chapterSlug);
      if (activeChIndex !== -1) {
        progressLabel = `อ่านถึงตอนที่ ${activeChIndex + 1}/${book.chapters.length} (${progressPercent}%)`;
      }
    }

    // Cover markup (custom fallback if no cover image)
    const coverMarkup = book.cover 
      ? `<img class="book-cover-img" src="${book.cover}" alt="ปก ${book.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="book-cover-fallback" style="display:none;">
           <span class="fallback-title">${book.title}</span>
         </div>`
      : `<div class="book-cover-fallback">
           <span class="fallback-title">${book.title}</span>
         </div>`;

    return `
      <article class="book-card" data-slug="${book.slug}">
        <div class="book-cover-container">
          ${coverMarkup}
        </div>
        <div class="book-info">
          <h2 class="book-title">${book.title}</h2>
        </div>
      </article>
    `;
  }).join('');

  // Add click listeners to book cards
  document.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', () => {
      const slug = card.getAttribute('data-slug');
      openBook(slug);
    });
  });
}

function openBook(bookSlug) {
  const book = novelsData.find(b => b.slug === bookSlug);
  if (!book || book.chapters.length === 0) return;

  // Retrieve progress, open last read chapter or fall back to chapter 1
  const progress = getBookProgress(bookSlug);
  let targetChapterSlug = book.chapters[0].slug;

  if (progress) {
    // Ensure the saved chapter still exists in current metadata
    const exists = book.chapters.some(c => c.slug === progress.chapterSlug);
    if (exists) {
      targetChapterSlug = progress.chapterSlug;
    }
  }

  window.location.hash = `#/book/${bookSlug}/chapter/${targetChapterSlug}`;
}

// ==========================================================================
// READER VIEW (LOAD DATA, PROGRESS, TEXT RENDERING)
// ==========================================================================
async function showReaderView(bookSlug, chapterSlug) {
  stopTTS();
  viewLibrary.classList.remove('active');
  viewReader.classList.remove('hidden');
  viewReader.classList.add('active');
  btnBackLibrary.classList.remove('hidden');
  appTitle.classList.add('hidden');
  readerControls.classList.remove('hidden');
  readingProgressContainer.classList.remove('hidden');

  // Load book metadata if switching books or first time
  if (!currentBook || currentBook.slug !== bookSlug) {
    currentBook = novelsData.find(b => b.slug === bookSlug);
    if (!currentBook) {
      console.error('Book not found:', bookSlug);
      window.location.hash = '#/';
      return;
    }
    renderTOC();
  }

  currentChapterIndex = currentBook.chapters.findIndex(c => c.slug === chapterSlug);
  if (currentChapterIndex === -1) {
    console.error('Chapter not found:', chapterSlug);
    window.location.hash = `#/book/${bookSlug}/chapter/${currentBook.chapters[0].slug}`;
    return;
  }

  // Highlight active chapter in TOC
  updateTOCActiveState();

  // Load and render chapter content
  readerContent.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>กำลังดาวน์โหลดบทเรียน...</p>
    </div>
  `;
  readerViewport.scrollTop = 0;

  try {
    const chapter = currentBook.chapters[currentChapterIndex];
    const response = await fetch(chapter.path);
    if (!response.ok) {
      throw new Error(`Failed to fetch chapter file: ${response.status}`);
    }
    
    const markdownText = await response.text();
    const renderedHtml = parseMarkdown(markdownText, bookSlug);
    
    // Inject chapter HTML
    readerContent.innerHTML = renderedHtml;

    // Attach click listeners for TTS paragraph selection
    setupParagraphClickListeners();

    // Set up Prev/Next buttons
    setupChapterNavigation();

    // Restore scroll position
    restoreScrollPosition(bookSlug, chapterSlug);

  } catch (err) {
    console.error('Error loading chapter content:', err);
    readerContent.innerHTML = `
      <div class="loading-spinner" style="color: #d9534f;">
        <p>ไม่สามารถดาวน์โหลดเนื้อหาตอนนี้ได้ (อาจอยู่ระหว่างออฟไลน์)</p>
        <button class="btn-icon" onclick="window.location.reload()" style="margin-top: 10px;">โหลดใหม่อีกครั้ง</button>
      </div>
    `;
  }
}

// Table of Contents inside reader sidebar
function renderTOC() {
  if (!currentBook) return;
  
  tocList.innerHTML = currentBook.chapters.map((ch, idx) => {
    return `
      <li class="toc-item" data-slug="${ch.slug}">
        <a class="toc-link" href="#/book/${currentBook.slug}/chapter/${ch.slug}">
          ตอนที่ ${idx + 1}: ${ch.title}
        </a>
      </li>
    `;
  }).join('');
}

function updateTOCActiveState() {
  if (!currentBook) return;
  const activeSlug = currentBook.chapters[currentChapterIndex].slug;
  
  document.querySelectorAll('.toc-item').forEach(item => {
    const slug = item.getAttribute('data-slug');
    item.classList.toggle('active', slug === activeSlug);
    
    // Optional checkmark style for completed chapters (already read)
    const progress = getBookProgress(currentBook.slug);
    if (progress) {
      // Mark chapters before the current active progress as read
      const chIndex = currentBook.chapters.findIndex(c => c.slug === slug);
      const activeProgressIndex = currentBook.chapters.findIndex(c => c.slug === progress.chapterSlug);
      item.classList.toggle('read', chIndex < activeProgressIndex);
    } else {
      item.classList.remove('read');
    }
  });
}

function setupChapterNavigation() {
  // Previous Chapter setup
  if (currentChapterIndex > 0) {
    const prevCh = currentBook.chapters[currentChapterIndex - 1];
    btnPrevChapter.disabled = false;
    prevChapterTitle.textContent = prevCh.title;
    btnPrevChapter.onclick = () => {
      window.location.hash = `#/book/${currentBook.slug}/chapter/${prevCh.slug}`;
    };
  } else {
    btnPrevChapter.disabled = true;
    prevChapterTitle.textContent = 'ไม่มีตอนก่อนหน้า';
    btnPrevChapter.onclick = null;
  }

  // Next Chapter setup
  if (currentChapterIndex < currentBook.chapters.length - 1) {
    const nextCh = currentBook.chapters[currentChapterIndex + 1];
    btnNextChapter.disabled = false;
    nextChapterTitle.textContent = nextCh.title;
    btnNextChapter.onclick = () => {
      window.location.hash = `#/book/${currentBook.slug}/chapter/${nextCh.slug}`;
    };
  } else {
    btnNextChapter.disabled = true;
    nextChapterTitle.textContent = 'จบเล่มแล้ว';
    btnNextChapter.onclick = null;
  }
}

// ==========================================================================
// SCROLL POSITION & READING PROGRESS TRACKING
// ==========================================================================
function getBookProgress(bookSlug) {
  const data = localStorage.getItem(`progress_${bookSlug}`);
  return data ? JSON.parse(data) : null;
}

function saveBookProgress(bookSlug, chapterSlug, scrollPercent) {
  let percent = 0;
  if (currentBook && currentBook.chapters) {
    const totalChapters = currentBook.chapters.length;
    // Estimated overall book completion percentage
    percent = (currentChapterIndex + scrollPercent) / totalChapters;
    percent = Math.max(0, Math.min(1, percent));
  }

  const progressData = {
    chapterSlug,
    scrollPercent,
    percent,
    timestamp: Date.now()
  };

  localStorage.setItem(`progress_${bookSlug}`, JSON.stringify(progressData));
}

function restoreScrollPosition(bookSlug, chapterSlug) {
  const progress = getBookProgress(bookSlug);
  readerViewport.scrollTop = 0;
  updateProgressBar(0);

  if (progress && progress.chapterSlug === chapterSlug) {
    // Use a slight timeout to let browser layout/render finish
    setTimeout(() => {
      const scrollHeight = readerViewport.scrollHeight;
      const clientHeight = readerViewport.clientHeight;
      const targetScroll = progress.scrollPercent * (scrollHeight - clientHeight);
      
      readerViewport.scrollTop = targetScroll;
      updateProgressBar(progress.scrollPercent);
    }, 150);
  }
}

function updateProgressBar(percent) {
  const roundedPercent = Math.round(percent * 100);
  readingProgressBar.style.width = `${roundedPercent}%`;
}

// Throttle scroll listener to protect LocalStorage performance
let scrollTimeout;
readerViewport.addEventListener('scroll', () => {
  if (!currentBook) return;

  const scrollTop = readerViewport.scrollTop;
  const scrollHeight = readerViewport.scrollHeight;
  const clientHeight = readerViewport.clientHeight;
  const maxScroll = scrollHeight - clientHeight;
  
  const scrollPercent = maxScroll > 0 ? scrollTop / maxScroll : 0;
  
  updateProgressBar(scrollPercent);

  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const chapter = currentBook.chapters[currentChapterIndex];
    saveBookProgress(currentBook.slug, chapter.slug, scrollPercent);
  }, 150);
});

// ==========================================================================
// TEXT-TO-SPEECH (TTS) ENGINE & CONTROLLER
// ==========================================================================
const ttsSynth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let ttsVoice = null;
let ttsParagraphs = [];
let ttsCurrentIndex = 0;
let isTTSPlaying = false;
let isTTSPaused = false;
let ttsRate = 1.0;

let thaiTTSVoices = [];
let currentAudioFallback = null;
let currentUtterance = null; // Global reference prevents Chrome Garbage Collection from stopping speech mid-paragraph!
let ttsSpeechId = 0; // Token to invalidate previous callbacks on new user click/change
let ttsHeartbeatTimer = null; // Chrome 15s freeze prevention timer

function clearTTSHeartbeat() {
  if (ttsHeartbeatTimer) {
    clearInterval(ttsHeartbeatTimer);
    ttsHeartbeatTimer = null;
  }
}

function startTTSHeartbeat() {
  clearTTSHeartbeat();
  // Chrome bug workaround: calling pause & resume every 10 seconds prevents Chrome from freezing/cancelling long speech
  ttsHeartbeatTimer = setInterval(() => {
    if (ttsSynth && ttsSynth.speaking && !ttsSynth.paused) {
      ttsSynth.pause();
      ttsSynth.resume();
    }
  }, 10000);
}

function populateVoiceList() {
  if (!ttsSynth) return;
  const rawVoices = ttsSynth.getVoices();

  // STRICT FILTER: Keep ONLY Thai voices
  if (rawVoices && rawVoices.length > 0) {
    thaiTTSVoices = rawVoices.filter(v => {
      const lang = (v.lang || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      return lang.startsWith('th') || lang.includes('th-th') || lang.includes('th_th') || /thai|ไทย|kanya|narisa|pattara|premwuti|niwat/i.test(name);
    });
  }

  if (thaiTTSVoices.length > 0) {
    if (!ttsVoice || !thaiTTSVoices.some(v => v.name === ttsVoice.name)) {
      ttsVoice = thaiTTSVoices[0]; // Auto select native Thai voice
    }
    if (ttsVoiceNotice) ttsVoiceNotice.classList.add('hidden');

    if (ttsVoiceSelect) {
      ttsVoiceSelect.innerHTML = thaiTTSVoices.map((v, i) => {
        const isSelected = ttsVoice && ttsVoice.name === v.name;
        return `<option value="${i}" ${isSelected ? 'selected' : ''}>🇹🇭 ${v.name}</option>`;
      }).join('');
    }
  } else {
    ttsVoice = null;
    if (ttsVoiceSelect) {
      ttsVoiceSelect.innerHTML = `<option value="-1">🇹🇭 เสียงภาษาไทย (ออนไลน์)</option>`;
    }
    if (ttsVoiceNotice) {
      ttsVoiceNotice.classList.remove('hidden');
      ttsVoiceNotice.innerHTML = `📌 <strong>คุณได้ติดตั้ง Thai Voice ใน Windows แล้ว!</strong> กรุณา <strong>"ปิดและเปิดเบราว์เซอร์ (Chrome/Edge) ใหม่อีก 1 ครั้ง"</strong> ตามที่ Windows แจ้งเตือนสีแดง เพื่อให้เบราว์เซอร์รับเสียงภาษาไทยจาก Windows ครับ`;
    }
  }
}

function initTTSVoices() {
  if (!ttsSynth) return;
  populateVoiceList();
  if (ttsSynth.onvoiceschanged !== undefined) {
    ttsSynth.onvoiceschanged = populateVoiceList;
  }
}

function getReadableParagraphs() {
  if (!readerContent) return [];
  const nodes = Array.from(readerContent.querySelectorAll('h1, h2, h3, p, blockquote, li'));
  return nodes.filter(el => {
    const text = el.textContent.trim();
    return text.length > 0 && !el.querySelector('img');
  });
}

function updateTTSPlayPauseUI() {
  if (isTTSPlaying && !isTTSPaused) {
    if (ttsIconPlay) ttsIconPlay.classList.add('hidden');
    if (ttsIconPause) ttsIconPause.classList.remove('hidden');
  } else {
    if (ttsIconPlay) ttsIconPlay.classList.remove('hidden');
    if (ttsIconPause) ttsIconPause.classList.add('hidden');
  }
}

function clearTTSHighlights() {
  if (!readerContent) return;
  readerContent.querySelectorAll('.tts-reading-highlight').forEach(el => {
    el.classList.remove('tts-reading-highlight');
  });
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function splitTextIntoSentenceChunks(text, maxLength = 180) {
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const chunks = [];
  const parts = text.split(/([,.\n!?|\s])/);
  let currentChunk = '';

  for (let part of parts) {
    if ((currentChunk + part).length > maxLength) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = part;
    } else {
      currentChunk += part;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  return chunks.length > 0 ? chunks : [text];
}

function speakThaiAudioFallback(text, onEndCallback) {
  stopAudioFallback();

  const chunks = splitTextIntoSentenceChunks(text);
  if (chunks.length === 0) {
    if (onEndCallback) onEndCallback();
    return;
  }

  let chunkIndex = 0;

  function playNextChunk() {
    if (!isTTSPlaying || isTTSPaused) return;

    if (chunkIndex >= chunks.length) {
      currentAudioFallback = null;
      if (onEndCallback) onEndCallback();
      return;
    }

    const chunkText = chunks[chunkIndex];
    const encodedText = encodeURIComponent(chunkText);
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=th&client=tw-ob`;

    const audio = new Audio(audioUrl);
    audio.playbackRate = ttsRate;
    currentAudioFallback = audio;

    audio.onended = () => {
      chunkIndex++;
      playNextChunk();
    };

    audio.onerror = (err) => {
      console.warn('[TTS] Audio chunk stream warning:', err);
      chunkIndex++;
      playNextChunk();
    };

    audio.play().catch(e => {
      console.warn('[TTS] Audio play blocked:', e);
      chunkIndex++;
      playNextChunk();
    });
  }

  playNextChunk();
}

function stopAudioFallback() {
  if (currentAudioFallback) {
    currentAudioFallback.pause();
    currentAudioFallback = null;
  }
}

function speakParagraph(index) {
  ttsParagraphs = getReadableParagraphs();
  if (ttsParagraphs.length === 0) {
    if (ttsProgressText) ttsProgressText.textContent = 'ไม่พบเนื้อหาให้อ่าน';
    return;
  }

  if (index < 0) index = 0;
  if (index >= ttsParagraphs.length) {
    stopTTS();
    if (ttsProgressText) ttsProgressText.textContent = 'อ่านจบตอนแล้ว';
    return;
  }

  // Increment speech ID token to invalidate any previous async callbacks
  ttsSpeechId++;
  const thisSpeechId = ttsSpeechId;

  ttsCurrentIndex = index;
  clearTTSHighlights();

  const targetNode = ttsParagraphs[index];
  targetNode.classList.add('tts-reading-highlight');
  targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });

  if (ttsProgressText) {
    ttsProgressText.textContent = `ย่อหน้า ${index + 1}/${ttsParagraphs.length}`;
  }

  const textToSpeak = targetNode.textContent.trim();
  isTTSPlaying = true;
  isTTSPaused = false;
  updateTTSPlayPauseUI();
  enableBackgroundAudioKeepAlive();
  requestWakeLock();
  updateMediaSession();

  // On iOS (iPhone/iPad) or devices where Web Speech API is killed on screen-lock/background:
  // Route through HTML5 Audio Stream engine directly to guarantee 100% continuous lock-screen & background playback!
  if (isIOS) {
    if (ttsSynth) ttsSynth.cancel();
    speakThaiAudioFallback(textToSpeak, () => {
      if (thisSpeechId === ttsSpeechId && isTTSPlaying && !isTTSPaused) {
        speakParagraph(ttsCurrentIndex + 1);
      }
    });
    return;
  }

  // Re-query voices in case user just restarted or updated voices
  populateVoiceList();

  // Mode 1: Native Speech Synthesis with installed Thai Voice
  if (ttsSynth && ttsVoice) {
    ttsSynth.cancel();
    stopAudioFallback();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.voice = ttsVoice;
    utterance.lang = ttsVoice.lang || 'th-TH';
    utterance.rate = ttsRate;

    // STORE IN GLOBAL VARIABLE to prevent Chrome Garbage Collection mid-paragraph!
    currentUtterance = utterance;

    utterance.onend = () => {
      clearTTSHeartbeat();
      currentUtterance = null;
      if (thisSpeechId === ttsSpeechId && isTTSPlaying && !isTTSPaused) {
        speakParagraph(ttsCurrentIndex + 1);
      }
    };

    utterance.onerror = (e) => {
      clearTTSHeartbeat();
      currentUtterance = null;
      if (thisSpeechId !== ttsSpeechId) return;
      console.warn('[TTS] Utterance error, switching to audio stream fallback:', e);
      speakThaiAudioFallback(textToSpeak, () => {
        if (thisSpeechId === ttsSpeechId && isTTSPlaying && !isTTSPaused) {
          speakParagraph(ttsCurrentIndex + 1);
        }
      });
    };

    startTTSHeartbeat();
    ttsSynth.speak(utterance);
    return;
  }

  // Mode 2: Online Audio Stream Fallback (When OS doesn't have a Thai Voice package installed)
  if (ttsSynth) ttsSynth.cancel();
  speakThaiAudioFallback(textToSpeak, () => {
    if (thisSpeechId === ttsSpeechId && isTTSPlaying && !isTTSPaused) {
      speakParagraph(ttsCurrentIndex + 1);
    }
  });
}

// Silent 1-second WAV audio loop encoded in base64 to acquire Background Audio Lock from iOS Safari & Android Chrome
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
let bgAudioKeepAlive = null;
let wakeLock = null;

function enableBackgroundAudioKeepAlive() {
  if (!bgAudioKeepAlive) {
    bgAudioKeepAlive = new Audio(SILENT_AUDIO_URI);
    bgAudioKeepAlive.loop = true;
    bgAudioKeepAlive.volume = 0.01;
  }
  bgAudioKeepAlive.play().catch(err => {
    console.warn('[TTS] Background audio keep-alive play warning:', err);
  });
}

function disableBackgroundAudioKeepAlive() {
  if (bgAudioKeepAlive) {
    bgAudioKeepAlive.pause();
  }
}

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      if (!wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('[TTS] Screen wake lock error:', err);
    }
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().then(() => { wakeLock = null; }).catch(() => { wakeLock = null; });
  }
}

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;

  const bookTitle = currentBook ? currentBook.title : 'Novelnaja Reader';
  const authorName = currentBook ? currentBook.author : 'นิยายส่วนตัว';
  const chapterName = (currentBook && currentBook.chapters && currentBook.chapters[currentChapterIndex]) 
    ? currentBook.chapters[currentChapterIndex].title 
    : '';

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${chapterName || bookTitle}`,
      artist: `${authorName} • ย่อหน้า ${ttsCurrentIndex + 1}/${ttsParagraphs.length}`,
      album: bookTitle,
      artwork: currentBook && currentBook.cover ? [
        { src: currentBook.cover, sizes: '512x512', type: 'image/png' }
      ] : []
    });

    navigator.mediaSession.playbackState = (isTTSPlaying && !isTTSPaused) ? 'playing' : 'paused';
  } catch (e) {
    console.warn('[TTS] Update MediaSession error:', e);
  }
}

function initMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.setActionHandler('play', () => { togglePlayPauseTTS(); });
    navigator.mediaSession.setActionHandler('pause', () => { togglePlayPauseTTS(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => { speakParagraph(ttsCurrentIndex - 1); });
    navigator.mediaSession.setActionHandler('nexttrack', () => { speakParagraph(ttsCurrentIndex + 1); });
  } catch (e) {
    console.warn('[TTS] MediaSession action handler error:', e);
  }
}

function openTTSPlayer(startIndex = 0) {
  body.classList.add('tts-active');
  if (ttsPlayerBar) {
    ttsPlayerBar.classList.remove('hidden');
  }

  speakParagraph(startIndex);
}

function togglePlayPauseTTS() {
  if (!isTTSPlaying && !isTTSPaused) {
    openTTSPlayer(ttsCurrentIndex);
  } else if (isTTSPlaying && !isTTSPaused) {
    if (ttsSynth && ttsVoice) {
      ttsSynth.pause();
    } else if (currentAudioFallback) {
      currentAudioFallback.pause();
    }
    disableBackgroundAudioKeepAlive();
    isTTSPaused = true;
    updateTTSPlayPauseUI();
    updateMediaSession();
  } else if (isTTSPaused) {
    if (ttsSynth && ttsVoice) {
      ttsSynth.resume();
    } else if (currentAudioFallback) {
      currentAudioFallback.play();
    }
    enableBackgroundAudioKeepAlive();
    isTTSPaused = false;
    isTTSPlaying = true;
    updateTTSPlayPauseUI();
    updateMediaSession();
  }
}

function stopTTS() {
  body.classList.remove('tts-active');
  ttsSpeechId++; // Invalidate any ongoing callbacks
  clearTTSHeartbeat();
  if (ttsSynth) {
    ttsSynth.cancel();
  }
  stopAudioFallback();
  disableBackgroundAudioKeepAlive();
  releaseWakeLock();
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.playbackState = 'none'; } catch (e) {}
  }
  currentUtterance = null;
  isTTSPlaying = false;
  isTTSPaused = false;
  clearTTSHighlights();
  updateTTSPlayPauseUI();
  if (ttsPlayerBar) {
    ttsPlayerBar.classList.add('hidden');
  }
}

function setupParagraphClickListeners() {
  const paragraphs = getReadableParagraphs();
  paragraphs.forEach((pNode, index) => {
    pNode.style.cursor = 'pointer';
    pNode.title = 'แตะเพื่อเริ่มฟังเสียงอ่านจากย่อหน้านี้';
    pNode.onclick = (e) => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;
      openTTSPlayer(index);
    };
  });
}

// ==========================================================================
// KINDLE CUSTOMIZATION SETTINGS
// ==========================================================================
function loadUserSettings() {
  const stored = localStorage.getItem('reader_settings');
  if (stored) {
    try {
      userSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch (e) {
      userSettings = { ...DEFAULT_SETTINGS };
    }
  } else {
    userSettings = { ...DEFAULT_SETTINGS };
  }
}

function saveUserSettings() {
  localStorage.setItem('reader_settings', JSON.stringify(userSettings));
}

function applyUserSettings() {
  // 1. Theme class on <body>
  body.className = ''; // reset classes
  body.classList.add(`theme-${userSettings.theme}`);
  
  themeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === userSettings.theme);
  });

  // 2. Formatting classes on <article id="reader-content">
  readerContent.className = 'reader-content'; // reset classes
  
  // Font Face
  readerContent.classList.add(`font-${userSettings.fontFamily}`);
  btnFontSerif.classList.toggle('active', userSettings.fontFamily === 'serif');
  btnFontSans.classList.toggle('active', userSettings.fontFamily === 'sans');

  // Font Size
  readerContent.classList.add(`size-${userSettings.fontSize}`);
  currentSizeLabel.textContent = FONT_SIZE_LABELS[userSettings.fontSize];

  // Margins Page Width
  readerContent.classList.add(`width-${userSettings.width}`);
  widthButtons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-width') === userSettings.width);
  });

  // Line spacing
  readerContent.classList.add(`lh-${userSettings.lineHeight}`);
  lhButtons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lh') === userSettings.lineHeight);
  });
}

// User settings listeners
themeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    userSettings.theme = btn.getAttribute('data-theme');
    saveUserSettings();
    applyUserSettings();
  });
});

btnFontSerif.addEventListener('click', () => {
  userSettings.fontFamily = 'serif';
  saveUserSettings();
  applyUserSettings();
});

btnFontSans.addEventListener('click', () => {
  userSettings.fontFamily = 'sans';
  saveUserSettings();
  applyUserSettings();
});

btnSizeDec.addEventListener('click', () => {
  const idx = FONT_SIZES.indexOf(userSettings.fontSize);
  if (idx > 0) {
    userSettings.fontSize = FONT_SIZES[idx - 1];
    saveUserSettings();
    applyUserSettings();
  }
});

btnSizeInc.addEventListener('click', () => {
  const idx = FONT_SIZES.indexOf(userSettings.fontSize);
  if (idx < FONT_SIZES.length - 1) {
    userSettings.fontSize = FONT_SIZES[idx + 1];
    saveUserSettings();
    applyUserSettings();
  }
});

widthButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    userSettings.width = btn.getAttribute('data-width');
    saveUserSettings();
    applyUserSettings();
  });
});

lhButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    userSettings.lineHeight = btn.getAttribute('data-lh');
    saveUserSettings();
    applyUserSettings();
  });
});

// ==========================================================================
// INTERACTIVE UI EVENT BINDINGS
// ==========================================================================

// Back to library button
btnBackLibrary.addEventListener('click', () => {
  window.location.hash = '#/';
});

// Table of Contents triggers
btnToc.addEventListener('click', (e) => {
  e.stopPropagation();
  body.classList.toggle('toc-open');
});

btnFloatToc.addEventListener('click', (e) => {
  e.stopPropagation();
  body.classList.toggle('toc-open');
});

btnCloseToc.addEventListener('click', () => {
  body.classList.remove('toc-open');
});

// Close TOC when clicking anywhere else in the reader view
readerViewport.addEventListener('click', (e) => {
  if (body.classList.contains('toc-open') && 
      !e.target.closest('#reader-toc') && 
      !e.target.closest('#btn-toc') && 
      !e.target.closest('#btn-float-toc')) {
    body.classList.remove('toc-open');
  }
});

// Settings popover triggers
btnSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPopover.classList.toggle('hidden');
});

btnCloseSettings.addEventListener('click', () => {
  settingsPopover.classList.add('hidden');
});

// Close settings popover when clicking outside
document.addEventListener('click', (e) => {
  if (!settingsPopover.classList.contains('hidden') && 
      !e.target.closest('#settings-popover') && 
      !e.target.closest('#btn-settings')) {
    settingsPopover.classList.add('hidden');
  }
});

// Scroll to top floating action
btnFloatTop.addEventListener('click', () => {
  readerViewport.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});

// Tab Switching between Bookshelf and Support
if (tabLibrary && tabSupport && supportContainer && searchSection) {
  tabLibrary.addEventListener('click', () => {
    tabLibrary.classList.add('active');
    tabSupport.classList.remove('active');
    
    searchSection.classList.remove('hidden');
    bookshelfGrid.classList.remove('hidden');
    supportContainer.classList.add('hidden');
  });

  tabSupport.addEventListener('click', () => {
    tabSupport.classList.add('active');
    tabLibrary.classList.remove('active');
    
    searchSection.classList.add('hidden');
    bookshelfGrid.classList.add('hidden');
    supportContainer.classList.remove('hidden');
  });
}

// Copy Account Number to Clipboard
const btnCopyAcc = document.getElementById('btn-copy-acc');
const accNumText = document.getElementById('acc-num-text');

if (btnCopyAcc && accNumText) {
  btnCopyAcc.addEventListener('click', (e) => {
    e.stopPropagation();
    const cleanNumber = accNumText.textContent.replace(/-/g, '').trim();
    navigator.clipboard.writeText(cleanNumber).then(() => {
      btnCopyAcc.textContent = 'COPIED!';
      btnCopyAcc.classList.add('copied');
      setTimeout(() => {
        btnCopyAcc.textContent = 'COPY';
        btnCopyAcc.classList.remove('copied');
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  });
}

// Bookshelf Search bar input listener
searchInput.addEventListener('input', () => {
  renderBookshelf();
});

// TTS UI Event Bindings
if (btnTTS) {
  btnTTS.addEventListener('click', (e) => {
    e.stopPropagation();
    if (ttsPlayerBar && !ttsPlayerBar.classList.contains('hidden')) {
      togglePlayPauseTTS();
    } else {
      openTTSPlayer(0);
    }
  });
}

if (btnFloatTTS) {
  btnFloatTTS.addEventListener('click', (e) => {
    e.stopPropagation();
    if (ttsPlayerBar && !ttsPlayerBar.classList.contains('hidden')) {
      togglePlayPauseTTS();
    } else {
      openTTSPlayer(0);
    }
  });
}

if (btnTTSPlayPause) {
  btnTTSPlayPause.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayPauseTTS();
  });
}

if (btnTTSStop) {
  btnTTSStop.addEventListener('click', (e) => {
    e.stopPropagation();
    stopTTS();
  });
}

if (btnTTSPrev) {
  btnTTSPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    speakParagraph(ttsCurrentIndex - 1);
  });
}

if (btnTTSNext) {
  btnTTSNext.addEventListener('click', (e) => {
    e.stopPropagation();
    speakParagraph(ttsCurrentIndex + 1);
  });
}

if (btnTTSClose) {
  btnTTSClose.addEventListener('click', (e) => {
    e.stopPropagation();
    body.classList.remove('tts-active');
    if (ttsPlayerBar) ttsPlayerBar.classList.add('hidden');
  });
}

if (ttsSpeedSelect) {
  ttsSpeedSelect.addEventListener('change', (e) => {
    ttsRate = parseFloat(e.target.value);
    if (isTTSPlaying && !isTTSPaused) {
      speakParagraph(ttsCurrentIndex);
    }
  });
}

if (ttsVoiceSelect) {
  ttsVoiceSelect.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value, 10);
    if (allTTSVoices[idx]) {
      ttsVoice = allTTSVoices[idx];
      if (isTTSPlaying && !isTTSPaused) {
        speakParagraph(ttsCurrentIndex);
      }
    }
  });
}

// Keyboard Navigation (Arrow keys Left/Right to change chapters)
document.addEventListener('keydown', (e) => {
  if (viewReader.classList.contains('hidden') || !currentBook) return;
  
  if (e.key === 'ArrowLeft' && currentChapterIndex > 0) {
    const prevCh = currentBook.chapters[currentChapterIndex - 1];
    window.location.hash = `#/book/${currentBook.slug}/chapter/${prevCh.slug}`;
  } else if (e.key === 'ArrowRight' && currentChapterIndex < currentBook.chapters.length - 1) {
    const nextCh = currentBook.chapters[currentChapterIndex + 1];
    window.location.hash = `#/book/${currentBook.slug}/chapter/${nextCh.slug}`;
  }
});

// Background audio visibility listener (keeps audio playing when tab/screen is backgrounded)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (isTTSPlaying && !isTTSPaused) {
      enableBackgroundAudioKeepAlive();
    }
  } else {
    // When returning to foreground, align scroll position
    if (isTTSPlaying && ttsParagraphs[ttsCurrentIndex]) {
      ttsParagraphs[ttsCurrentIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});

// ==========================================================================
// APPLICATION INITIALIZATION
// ==========================================================================
async function initApp() {
  loadUserSettings();
  applyUserSettings();
  initTTSVoices();
  initMediaSessionHandlers();

  try {
    // Fetch novels.json index
    const response = await fetch('./novels.json');
    if (!response.ok) {
      throw new Error(`Failed to load novels database: ${response.status}`);
    }
    novelsData = await response.json();
    
    // Setup routing and first view
    initRouter();

  } catch (err) {
    console.error('Error initializing Kindle Novel Reader database:', err);
    bookshelfGrid.innerHTML = `
      <div class="loading-spinner" style="color: #d9534f;">
        <p>ไม่สามารถโหลดฐานข้อมูลนิยายได้</p>
        <p style="font-size: 0.85rem; margin-top: 4px;">กรุณาเปิดเว็บบน Local Server (เช่น node server.js) หรือตรวจสอบไฟล์ novels.json</p>
        <button class="btn-icon" onclick="window.location.reload()" style="margin-top: 10px;">ลองใหม่อีกครั้ง</button>
      </div>
    `;
  }
}

initApp();
