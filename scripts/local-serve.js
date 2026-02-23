/**
 * Local dev server that matches production routing behavior.
 *
 * Zero external dependencies — uses only Node built-ins.
 * Reads serve.json rewrites and applies them the same way Cloudflare Pages does.
 * Replaces the old serve-handler approach (serve package removed in M7).
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const config   = require(path.join(ROOT_DIR, 'serve.json'));

const PORT = Number(process.env.PORT) || 5500;

/* ── MIME map ──────────────────────────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.pdf':  'application/pdf',
  '.xml':  'application/xml',
  '.txt':  'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
};

/* ── Compile serve.json rewrites into matchers ─────────────── */
function compileRewrites(rewrites) {
  return (rewrites || []).map(r => {
    // Convert :slug patterns to regex capture groups
    const pattern = r.source
      .replace(/:[a-zA-Z]+/g, '([^/]+)')
      .replace(/\//g, '\\/');
    return {
      regex: new RegExp('^' + pattern + '$'),
      destination: r.destination,
      source: r.source,
    };
  });
}

const compiledRewrites = compileRewrites(config.rewrites);

function applyRewrite(pathname) {
  for (const rule of compiledRewrites) {
    const m = pathname.match(rule.regex);
    if (!m) continue;
    let dest = rule.destination;
    // Replace :slug placeholders with captured groups
    const slugs = (rule.source.match(/:[a-zA-Z]+/g) || []);
    slugs.forEach((slug, i) => {
      dest = dest.replace(slug, m[i + 1]);
    });
    return dest;
  }
  return null;
}

/* ── Helpers ───────────────────────────────────────────────── */
function redirect(res, location, statusCode = 301) {
  res.statusCode = statusCode;
  res.setHeader('Location', location);
  res.end();
}

function serveFile(res, filePath) {
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length });
    res.end(data);
  } catch {
    return false;
  }
  return true;
}

function tryFile(res, relativePath) {
  const abs = path.join(ROOT_DIR, relativePath);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    return serveFile(res, abs);
  }
  return false;
}

function serve404(res) {
  const page = path.join(ROOT_DIR, '404.html');
  res.statusCode = 404;
  if (fs.existsSync(page)) {
    const data = fs.readFileSync(page);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(data);
  } else {
    res.end('Not Found');
  }
}

/* ── Request handler ───────────────────────────────────────── */
const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = requestUrl.pathname;

  // Canonical trailing slash rules (match production expectations)
  if (pathname === '/projects') return redirect(res, '/projects/');
  if (pathname === '/hobbies')  return redirect(res, '/hobbies/');
  // /hobbies-games is canonical WITHOUT trailing slash
  if (pathname === '/hobbies-games/') return redirect(res, '/hobbies-games');

  // 1. Try serve.json rewrites first
  const rewritten = applyRewrite(pathname);
  if (rewritten) {
    // Directory rewrites → serve index.html inside
    if (rewritten.endsWith('/')) {
      if (tryFile(res, rewritten + 'index.html')) return;
    }
    if (tryFile(res, rewritten)) return;
  }

  // 2. Try the literal file on disk
  if (tryFile(res, pathname)) return;

  // 3. Clean URLs: try appending .html
  if (config.cleanUrls && !path.extname(pathname)) {
    if (tryFile(res, pathname + '.html')) return;
  }

  // 4. Directory index
  if (pathname.endsWith('/')) {
    if (tryFile(res, pathname + 'index.html')) return;
  }

  serve404(res);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Serving on http://localhost:${PORT}`);
});
