import { marked } from 'marked';

// ==========================================================================
// APPLICATION STATE
// ==========================================================================
let novels = [];
let currentBook = null;
let currentChapterIndex = -1;

const DEFAULT_SETTINGS = {
  theme: 'light',
  fontFamily: 'serif',
  fontSize: 'medium', // small, medium, large, xlarge
  width: 'medium'     // narrow, medium, wide
};

let userSettings = { ...DEFAULT_SETTINGS };

// ==========================================================================
// SELECTORS
// ==========================================================================
const body = document.body;
const libraryView = document.getElementById('library-view');
const readerView = document.getElementById('reader-view');
const bookshelfGrid = document.getElementById('bookshelf-grid');
const readerContent = document.getElementById('reader-content');
const readingViewport = document.getElementById('reading-viewport');
const tocList = document.getElementById('toc-list');
const settingsPopover = document.getElementById('settings-popover');
const readingProgressBar = document.getElementById('reading-progress-bar');
const readingProgressContainer = document.getElementById('reading-progress-container');

// Buttons & Header Controls
const btnBackLibrary = document.getElementById('btn-back-library');
const appTitle = document.getElementById('app-title');
const readerControls = document.getElementById('reader-controls');
const btnToc = document.getElementById('btn-toc');
const btnSettings = document.getElementById('btn-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCloseToc = document.getElementById('btn-close-toc');

// Navigation Buttons
const btnPrevChapter = document.getElementById('btn-prev-chapter');
const btnNextChapter = document.getElementById('btn-next-chapter');
const prevChapterTitle = document.getElementById('prev-chapter-title');
const nextChapterTitle = document.getElementById('next-chapter-title');

// Floating buttons
const btnFloatToc = document.getElementById('btn-float-toc');
const btnFloatTop = document.getElementById('btn-float-top');

// Settings controls
const themeButtons = document.querySelectorAll('.theme-opt');
const btnFontSerif = document.getElementById('btn-font-serif');
const btnFontSans = document.getElementById('btn-font-sans');
const btnSizeDec = document.getElementById('btn-size-dec');
const btnSizeInc = document.getElementById('btn-size-inc');
const currentSizeLabel = document.getElementById('current-size-label');
const widthButtons = document.querySelectorAll('.width-opt');

const FONT_SIZES = ['small', 'medium', 'large', 'xlarge'];
const FONT_SIZE_LABELS = {
  small: 'เล็ก (85%)',
  medium: 'ปกติ (100%)',
  large: 'ใหญ่ (120%)',
  xlarge: 'ใหญ่พิเศษ (140%)'
};

// ==========================================================================
// ROUTER MECHANISM (Hash-based)
// ==========================================================================
function handleRoute() {
  const hash = window.location.hash || '#/';
  
  // Close popovers and menus on navigate
  settingsPopover.classList.add('hidden');
  body.classList.remove('toc-open');

  if (hash === '#/') {
    showLibraryView();
  } else {
    // Expected route: #/book/:bookSlug/chapter/:chapterSlug
    const match = hash.match(/^#\/book\/([^/]+)\/chapter\/([^/]+)$/);
    if (match) {
      const bookSlug = match[1];
      const chapterSlug = match[2];
      showReaderView(bookSlug, chapterSlug);
    } else {
      // Fallback
      window.location.hash = '#/';
    }
  }
}

// Set up router listeners
window.addEventListener('hashchange', handleRoute);
window.addEventListener('load', () => {
  loadUserSettings();
  applyUserSettings();
  loadNovelsIndex().then(() => {
    handleRoute();
  });
});

// ==========================================================================
// LIBRARY VIEW CONTROLLER
// ==========================================================================
async function loadNovelsIndex() {
  try {
    const response = await fetch('./novels.json');
    if (!response.ok) throw new Error('Failed to fetch novels index');
    novels = await response.json();
  } catch (err) {
    console.error('Error loading novels index:', err);
    bookshelfGrid.innerHTML = `
      <div class="loading-spinner">
        <p style="color: red;">❌ ไม่สามารถโหลดนิยายได้ กรุณาลองตรวจสอบสคริปต์ generate-index หรือการเชื่อมต่อเซิร์ฟเวอร์</p>
      </div>
    `;
  }
}

function showLibraryView() {
  libraryView.classList.remove('hidden');
  readerView.classList.add('hidden');
  
  // Header adjustments
  btnBackLibrary.classList.add('hidden');
  appTitle.classList.remove('hidden');
  readerControls.classList.add('hidden');
  readingProgressContainer.classList.add('hidden');

  renderLibrary();
}

function renderLibrary() {
  if (novels.length === 0) {
    bookshelfGrid.innerHTML = `
      <div class="loading-spinner">
        <p>📭 ไม่พบไฟล์นิยาย กรุณาใส่โฟลเดอร์นิยายใน public/novels/ แล้วกดรัน npm run dev อีกครั้ง</p>
      </div>
    `;
    return;
  }

  bookshelfGrid.innerHTML = novels.map(book => {
    // Get progress details
    const progress = getBookProgress(book.slug);
    const progressPercent = progress ? Math.round(progress.percent * 100) : 0;
    
    // Find chapter name for the progress description
    let progressDesc = 'ยังไม่ได้เริ่มอ่าน';
    if (progress && book.chapters) {
      const activeChapter = book.chapters.find(c => c.slug === progress.chapterSlug);
      if (activeChapter) {
        progressDesc = `กำลังอ่าน: ${activeChapter.title}`;
      }
    }

    const coverHtml = book.cover 
      ? `<img src="${book.cover}" alt="${book.title}" class="novel-cover" loading="lazy">`
      : `<div class="novel-cover-placeholder">
          <i data-lucide="book"></i>
          <span>${book.title}</span>
         </div>`;

    return `
      <div class="novel-card" data-slug="${book.slug}">
        <div class="novel-cover-wrapper">
          ${coverHtml}
        </div>
        <div class="novel-info">
          <h3 class="novel-title">${book.title}</h3>
          <span class="novel-author"><i data-lucide="user" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i>${book.author}</span>
          <p class="novel-desc">${book.description}</p>
          <div class="card-progress-wrapper">
            <div class="card-progress-text">
              <span>${progressDesc}</span>
              <span>${progressPercent}%</span>
            </div>
            <div class="card-progress-bar-bg">
              <div class="card-progress-bar-fill" style="width: ${progressPercent}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Re-initialize icons inside cards
  lucide.createIcons();

  // Add click listeners to cards
  document.querySelectorAll('.novel-card').forEach(card => {
    card.addEventListener('click', () => {
      const slug = card.getAttribute('data-slug');
      openBook(slug);
    });
  });
}

function openBook(bookSlug) {
  const book = novels.find(b => b.slug === bookSlug);
  if (!book || !book.chapters || book.chapters.length === 0) return;

  // Check last read progress
  const progress = getBookProgress(bookSlug);
  let targetChapterSlug = book.chapters[0].slug;

  if (progress) {
    // Make sure the saved chapter still exists
    const exists = book.chapters.some(c => c.slug === progress.chapterSlug);
    if (exists) {
      targetChapterSlug = progress.chapterSlug;
    }
  }

  // Navigate to target chapter
  window.location.hash = `#/book/${bookSlug}/chapter/${targetChapterSlug}`;
}

// ==========================================================================
// READER VIEW CONTROLLER
// ==========================================================================
async function showReaderView(bookSlug, chapterSlug) {
  currentBook = novels.find(b => b.slug === bookSlug);
  if (!currentBook) {
    // If book doesn't exist, head back to library
    window.location.hash = '#/';
    return;
  }

  currentChapterIndex = currentBook.chapters.findIndex(c => c.slug === chapterSlug);
  if (currentChapterIndex === -1) {
    // If chapter doesn't exist in book, go to first chapter
    window.location.hash = `#/book/${bookSlug}/chapter/${currentBook.chapters[0].slug}`;
    return;
  }

  // Toggle visible sections
  libraryView.classList.add('hidden');
  readerView.classList.remove('hidden');
  
  // Header adjustments
  btnBackLibrary.classList.remove('hidden');
  appTitle.classList.add('hidden');
  readerControls.classList.remove('hidden');
  readingProgressContainer.classList.remove('hidden');

  const chapter = currentBook.chapters[currentChapterIndex];
  
  // Render loading state
  readerContent.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>กำลังเปิดหนังสือ...</p>
    </div>
  `;
  
  // Update TOC Highlight
  renderTOC();

  // Fetch and render chapter markdown
  try {
    const response = await fetch(chapter.path);
    if (!response.ok) throw new Error('Failed to load chapter file');
    const markdown = await response.ok ? await response.text() : '';
    
    // Parse Markdown to HTML
    const htmlContent = marked.parse(markdown);
    
    // Inject and update layout
    readerContent.innerHTML = htmlContent;
    document.title = `${chapter.title} - ${currentBook.title}`;
    
    // Re-initialize any inner elements if needed
    lucide.createIcons();

    // Setup Bottom navigation
    setupReaderNavigation();

    // Scroll positioning
    restoreScrollPosition(bookSlug, chapterSlug);

  } catch (err) {
    console.error('Error loading chapter:', err);
    readerContent.innerHTML = `
      <div style="padding: 40px; text-align: center; color: red;">
        <h3>❌ เกิดข้อผิดพลาดในการโหลดบทความ</h3>
        <p>ไม่สามารถเปิดไฟล์บทความที่กำหนดได้ กรุณาตรวจสอบว่ามีไฟล์นี้อยู่จริง</p>
        <button onclick="window.location.hash = '#/'" class="btn-icon" style="margin: 20px auto; border: 1px solid var(--border-color)">
          กลับไปคลังนิยาย
        </button>
      </div>
    `;
  }
}

function renderTOC() {
  if (!currentBook) return;

  tocList.innerHTML = currentBook.chapters.map((ch, idx) => {
    const isActive = idx === currentChapterIndex;
    return `
      <li>
        <a href="#/book/${currentBook.slug}/chapter/${ch.slug}" 
           class="toc-item-link ${isActive ? 'active' : ''}">
           ${ch.title}
        </a>
      </li>
    `;
  }).join('');
}

function setupReaderNavigation() {
  if (!currentBook) return;

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
// SCROLL POSITION & READING PROGRESS RETRIEVAL/PERSISTENCE
// ==========================================================================
function getBookProgress(bookSlug) {
  const data = localStorage.getItem(`progress_${bookSlug}`);
  return data ? JSON.parse(data) : null;
}

function saveBookProgress(bookSlug, chapterSlug, scrollPercent) {
  // Simple calculation of overall book completion:
  // (currentChapterIndex + scrollPercent) / totalChapters
  let percent = 0;
  if (currentBook && currentBook.chapters) {
    const totalChapters = currentBook.chapters.length;
    percent = (currentChapterIndex + scrollPercent) / totalChapters;
    // Cap between 0 and 1
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

// Scroll restoration with a slight delay to ensure rendering is completed
function restoreScrollPosition(bookSlug, chapterSlug) {
  const progress = getBookProgress(bookSlug);
  readingViewport.scrollTop = 0;
  updateProgressBar(0);

  if (progress && progress.chapterSlug === chapterSlug) {
    setTimeout(() => {
      const scrollHeight = readingViewport.scrollHeight;
      const clientHeight = readingViewport.clientHeight;
      const targetScroll = progress.scrollPercent * (scrollHeight - clientHeight);
      
      readingViewport.scrollTop = targetScroll;
      updateProgressBar(progress.scrollPercent);
    }, 100); // 100ms delay for content parsing and layout painting
  }
}

function updateProgressBar(percent) {
  const roundedPercent = Math.round(percent * 100);
  readingProgressBar.style.width = `${roundedPercent}%`;
}

// Throttled Scroll Listener on the Reading Viewport
let scrollTimeout;
readingViewport.addEventListener('scroll', () => {
  if (!currentBook) return;

  const scrollTop = readingViewport.scrollTop;
  const scrollHeight = readingViewport.scrollHeight;
  const clientHeight = readingViewport.clientHeight;
  const maxScroll = scrollHeight - clientHeight;
  
  const scrollPercent = maxScroll > 0 ? scrollTop / maxScroll : 0;
  
  updateProgressBar(scrollPercent);

  // Throttle writing to LocalStorage to improve performance
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const chapter = currentBook.chapters[currentChapterIndex];
    saveBookProgress(currentBook.slug, chapter.slug, scrollPercent);
  }, 150);
});

// ==========================================================================
// READER PREFERENCES & VISUAL CUSTOMIZATION
// ==========================================================================
function loadUserSettings() {
  const stored = localStorage.getItem('reader_settings');
  if (stored) {
    try {
      userSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch (e) {
      userSettings = { ...DEFAULT_SETTINGS };
    }
  }
}

// Clear any left-over Google Drive mode so it falls back to local immediately
function saveUserSettings() {
  if (userSettings.dataSource) delete userSettings.dataSource;
  if (userSettings.gdriveUrl) delete userSettings.gdriveUrl;
  localStorage.setItem('reader_settings', JSON.stringify(userSettings));
}

function applyUserSettings() {
  // 1. Theme
  body.className = ''; // Reset classes
  body.classList.add(`theme-${userSettings.theme}`);
  
  // Set theme selectors active state
  themeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === userSettings.theme);
  });

  // 2. Reader content custom classes
  readerContent.className = 'reader-content'; // Reset
  
  // Font
  readerContent.classList.add(`font-${userSettings.fontFamily}`);
  btnFontSerif.classList.toggle('active', userSettings.fontFamily === 'serif');
  btnFontSans.classList.toggle('active', userSettings.fontFamily === 'sans');

  // Font size
  readerContent.classList.add(`size-${userSettings.fontSize}`);
  currentSizeLabel.textContent = FONT_SIZE_LABELS[userSettings.fontSize];

  // Width
  readerContent.classList.add(`width-${userSettings.width}`);
  widthButtons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-width') === userSettings.width);
  });
}

// Customization Event Listeners
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

// ==========================================================================
// INTERACTIVE UI TOGGLES (Popovers, Sidebars, Actions)
// ==========================================================================
btnBackLibrary.addEventListener('click', () => {
  window.location.hash = '#/';
});

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

// Prevent clicks inside TOC from closing TOC, but close on clicking viewport
readerView.addEventListener('click', (e) => {
  if (body.classList.contains('toc-open') && !e.target.closest('#reader-toc') && !e.target.closest('#btn-toc') && !e.target.closest('#btn-float-toc')) {
    body.classList.remove('toc-open');
  }
});

btnSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPopover.classList.toggle('hidden');
});

btnCloseSettings.addEventListener('click', () => {
  settingsPopover.classList.add('hidden');
});

// Close popover if clicked outside
document.addEventListener('click', (e) => {
  if (!settingsPopover.classList.contains('hidden') && !e.target.closest('#settings-popover') && !e.target.closest('#btn-settings')) {
    settingsPopover.classList.add('hidden');
  }
});

// Floating scroll-to-top
btnFloatTop.addEventListener('click', () => {
  readingViewport.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});

// Keyboard navigation (Arrow keys left/right to change chapters)
document.addEventListener('keydown', (e) => {
  if (readerView.classList.contains('hidden')) return;
  
  if (e.key === 'ArrowLeft' && currentChapterIndex > 0) {
    const prevCh = currentBook.chapters[currentChapterIndex - 1];
    window.location.hash = `#/book/${currentBook.slug}/chapter/${prevCh.slug}`;
  } else if (e.key === 'ArrowRight' && currentBook && currentChapterIndex < currentBook.chapters.length - 1) {
    const nextCh = currentBook.chapters[currentChapterIndex + 1];
    window.location.hash = `#/book/${currentBook.slug}/chapter/${nextCh.slug}`;
  }
});

// Register Service Worker for PWA Offline capability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered successfully with scope:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}
