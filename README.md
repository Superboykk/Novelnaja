# Kindle Novel Reader PWA

A premium, Kindle-like Progressive Web Application (PWA) designed to read offline novels. It is hosted on GitHub Pages and reads novels from the `./novels` directory. It features warm reading themes, typographic customization, offline support, search capabilities, and automatic index updates via GitHub Actions.

---

## Features

- **📚 Beautiful Bookshelf Grid**: Lists all indexed novels with cover images, descriptions, authors, and real-time reading progress.
- **🔍 Book Search**: Filter books instantly by title, author, or description.
- **📖 Kindle-Like Reading Interface**:
  - **Reading Themes**: Light Paper, Warm Sepia, Sage Mint Green, Muted Newsprint Grey, and OLED Black.
  - **Custom Typography**: Serif (Lora/Merriweather) or Sans-serif (Sarabun/Inter), with 6 font sizes, 3 text-width layouts, and 3 line-height adjustments.
  - **Typographical Indentation**: Classical novel typesetting (automatic indenting on inner paragraphs, no-indent on leading paragraphs).
- **💾 Automatic Progress Recovery**: Tracks your exact reading chapter and scroll percentage for every novel. Open any book to resume reading exactly where you left off.
- **📑 Sidebar Table of Contents**: View chapter lists, complete with checkmarks indicating which chapters have been read.
- **📱 PWA Offline Support**: Installs on mobile or desktop and caches books and chapters for offline reading (e.g., in subways or airplanes).
- **🤖 GitHub Pages Auto-Update**: Adding a new folder to the `novels/` directory and pushing it to GitHub automatically triggers a build action to update the bookshelf index.

---

## Project Structure

```
Novel App/
├── .github/workflows/
│   └── deploy.yml       # GitHub Actions automated deployment workflow
├── novels/                  # Novel folders (Add your novels here!)
│   ├── Bof2 Novel/
│   ├── KGB Naruto novel/
│   └── the-shadow-chronicles/
├── generate-index.js        # Node script that scans novels/ and creates novels.json
├── server.js                # Built-in zero-dependency local web server
├── index.html               # Main app page (shelf and reading views)
├── style.css                # Visual themes and responsive layouts
├── app.js                   # Application state, router, and Markdown parser
├── manifest.json            # PWA manifest
├── sw.js                    # Service worker for offline caching
├── icon-192.png             # PWA app icons
├── icon-512.png
├── novels.json              # Compiled database of books (auto-generated)
└── package.json             # NPM package script helper
```

---

## How to Add New Novels

To add a new novel, create a folder inside the `novels/` directory:

1. **Folder Name**: The name of the folder is used to generate the book's slug and default title (e.g. `novels/My-New-Novel`).
2. **Chapters**: Add chapters as Markdown (`.md`) files. They will be sorted in natural numeric order (e.g., `Chapter_1.md`, `Chapter_2.md`... `Chapter_10.md`).
3. **Cover Image**: Add a cover image (`.png`, `.jpg`, `.jpeg`, `.webp`, or `.gif`). The script looks for a file named `cover` or `thumbnail` (e.g., `cover.png`), falling back to the first image in the folder if not found.
4. **Metadata (Optional)**: Add a `metadata.json` file inside the novel folder to customize details:
   ```json
   {
     "title": "My Custom Book Title",
     "author": "Author Name",
     "description": "An epic description of your story."
   }
   ```

---

## Local Development

You can run and test the application locally without installing any external dependencies.

1. **Compile the novels database**:
   Run this command in the project root to scan the `novels/` directory and compile the database `novels.json`:
   ```bash
   npm run generate
   # or
   node generate-index.js
   ```

2. **Start the local web server**:
   Start the zero-dependency web server:
   ```bash
   npm start
   # or
   node server.js
   ```

3. **Open the App**:
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## Automatic Deployment to GitHub Pages

The project contains a GitHub Action that automates index generation and deployment:

1. **Push Changes**: When you add a new novel folder to `novels/` locally, commit it and push it to your GitHub repository:
   ```bash
   git add novels/
   git commit -m "Add new novel: My Novel"
   git push origin main
   ```
2. **Automatic Deployment**: The workflow `.github/workflows/deploy.yml` will automatically trigger in GitHub Actions. It will run `node generate-index.js` to update the index and deploy the website to GitHub Pages.
3. **Update Complete**: In a few minutes, your GitHub Pages site will automatically refresh with the newly added book!
