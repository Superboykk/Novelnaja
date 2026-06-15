import fs from 'fs';
import path from 'path';

const NOVELS_DIR = path.resolve('novels');
const OUTPUT_FILE = path.resolve('novels.json');

// Helper to format names nicely
function formatTitle(str) {
  // e.g. "01-my-first-novel" -> "My First Novel"
  let clean = str.replace(/^\d+[-_]*/, ''); // remove leading numbers and separators
  clean = clean.replace(/[-_]+/g, ' ');     // replace dashes and underscores with spaces
  return clean
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Natural sort for strings containing numbers (e.g. Chapter_2 before Chapter_10, Sub-chapter 1.1 before 1.2)
function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

async function run() {
  console.log('Generating novels index...');

  // Ensure novels directory exists
  if (!fs.existsSync(NOVELS_DIR)) {
    console.error(`Error: novels directory not found at ${NOVELS_DIR}`);
    process.exit(1);
  }

  const books = [];

  try {
    const entries = await fs.promises.readdir(NOVELS_DIR, { withFileTypes: true });
    const bookDirs = entries.filter(entry => entry.isDirectory());

    for (const dir of bookDirs) {
      const bookSlug = dir.name;
      const bookPath = path.join(NOVELS_DIR, bookSlug);
      
      const files = await fs.promises.readdir(bookPath);
      
      // Filter md files and image files
      const mdFiles = files.filter(f => f.endsWith('.md')).sort(naturalSort);
      const imgFiles = files.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
      });

      if (mdFiles.length === 0) {
        console.log(`Skipping book directory "${bookSlug}": No .md files found.`);
        continue;
      }

      // Detect cover image
      // Prefer files named "cover", "thumbnail", or "folder" (case insensitive)
      let coverFile = null;
      if (imgFiles.length > 0) {
        const preferred = imgFiles.find(f => {
          const name = path.basename(f, path.extname(f)).toLowerCase();
          return name === 'cover' || name === 'thumbnail' || name === 'folder';
        });
        coverFile = preferred || imgFiles[0];
      }

      // Check if there is a metadata.json for custom title/description/author
      let bookTitle = formatTitle(bookSlug);
      let bookAuthor = 'Unknown Author';
      let bookDescription = 'No description available.';

      const metaPath = path.join(bookPath, 'metadata.json');
      if (fs.existsSync(metaPath)) {
        try {
          const metaContent = await fs.promises.readFile(metaPath, 'utf8');
          const meta = JSON.parse(metaContent);
          if (meta.title) bookTitle = meta.title;
          if (meta.author) bookAuthor = meta.author;
          if (meta.description) bookDescription = meta.description;
        } catch (err) {
          console.warn(`Warning: Failed to parse metadata.json in ${bookSlug}`, err);
        }
      }

      const chapters = [];

      for (const file of mdFiles) {
        const filePath = path.join(bookPath, file);
        const fileContent = await fs.promises.readFile(filePath, 'utf8');

        // Extract title: search for first "# Chapter Title" heading
        const lines = fileContent.split('\n');
        let chapterTitle = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('# ')) {
            chapterTitle = trimmed.substring(2).trim();
            break;
          } else if (trimmed.startsWith('## ')) {
            chapterTitle = trimmed.substring(3).trim();
            break;
          }
        }

        if (!chapterTitle) {
          // Fallback to formatted filename (without extension)
          const nameWithoutExt = path.basename(file, '.md');
          // e.g. "Chapter_1" -> "Chapter 1"
          chapterTitle = nameWithoutExt.replace(/_/g, ' ');
        }

        chapters.push({
          slug: file,
          title: chapterTitle,
          path: `novels/${bookSlug}/${file}`
        });
      }

      books.push({
        slug: bookSlug,
        title: bookTitle,
        author: bookAuthor,
        description: bookDescription,
        cover: coverFile ? `novels/${bookSlug}/${coverFile}` : null,
        chapters: chapters
      });

      console.log(`Indexed book: ${bookTitle} (${chapters.length} chapters)`);
    }

    // Write novels.json
    await fs.promises.writeFile(OUTPUT_FILE, JSON.stringify(books, null, 2), 'utf8');
    console.log(`Successfully generated index at: ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('Error generating index:', error);
    process.exit(1);
  }
}

run();
