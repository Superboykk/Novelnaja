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
    const bookSlug = parts[2];
    const chapterSlug = parts[4];

    if (bookSlug && chapterSlug) {
      await showReaderView(bookSlug, decodeURIComponent(chapterSlug));
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
  viewReader.classList.add('hidden');
  viewLibrary.classList.add('active');
  btnBackLibrary.classList.add('hidden');
  appTitle.classList.remove('hidden');
  readerControls.classList.add('hidden');
  readingProgressContainer.classList.add('hidden');

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
           <span class="fallback-author">${book.author}</span>
         </div>`
      : `<div class="book-cover-fallback">
           <span class="fallback-title">${book.title}</span>
           <span class="fallback-author">${book.author}</span>
         </div>`;

    return `
      <article class="book-card" data-slug="${book.slug}">
        <div class="book-cover-container">
          ${coverMarkup}
        </div>
        <div class="book-info">
          <h2 class="book-title">${book.title}</h2>
          <div class="book-author">โดย ${book.author}</div>
          <p class="book-description">${book.description}</p>
        </div>
        <div class="book-card-progress">
          <div class="progress-labels">
            <span>${progressLabel}</span>
          </div>
          <div class="progress-track">
            <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
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
  viewLibrary.classList.remove('active');
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

// Bookshelf Search bar input listener
searchInput.addEventListener('input', () => {
  renderBookshelf();
});

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

// ==========================================================================
// APPLICATION INITIALIZATION
// ==========================================================================
async function initApp() {
  loadUserSettings();
  applyUserSettings();

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
