import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Handle favicon.ico explicitly or fall through
  let urlPath = req.url.split('?')[0]; // strip query params
  if (urlPath === '/' || urlPath === '') {
    urlPath = '/index.html';
  }

  // Resolve absolute file path
  // Must decode URI to handle folder names with spaces like "Bof2 Novel"
  const decodedPath = decodeURIComponent(urlPath);
  const filePath = path.join(path.resolve('.'), decodedPath);

  // Security check: ensure the path stays inside the project root
  if (!filePath.startsWith(path.resolve('.'))) {
    res.statusCode = 403;
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(`404 Not Found: ${decodedPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);

    // Stream the file content
    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      console.error('Stream error:', streamErr);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`  Kindle Novel Reader Local Server Running`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Press Ctrl+C to stop the server`);
  console.log(`==================================================\n`);
});
