const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5500;
const ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Normalize URL
  let urlPath = req.url.split('?')[0];
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  
  let filePath = path.join(ROOT, urlPath);
  let ext = path.extname(filePath);
  
  // Clean URL handling: try appending .html if no extension
  if (!ext) {
    if (fs.existsSync(filePath + '.html')) {
      filePath += '.html';
      ext = '.html';
    } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
      ext = '.html';
    }
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Try 404.html
        fs.readFile(path.join(ROOT, '404.html'), (err404, content404) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(content404 || '404 Not Found', 'utf-8');
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Serving root: ${ROOT}`);
});
