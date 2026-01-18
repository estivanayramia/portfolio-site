/**
 * Local dev server that matches production routing behavior.
 *
 * Why: serve-handler normalizes paths via path.posix.resolve(), which makes it
 * impossible to distinguish /projects from /projects/ using serve.json redirects.
 * This wrapper applies the few canonical redirects we need, then delegates to
 * serve-handler using the existing serve.json rewrites.
 */

const http = require('http');
const path = require('path');
const handler = require('serve-handler');

const ROOT_DIR = path.join(__dirname, '..');
const config = require(path.join(ROOT_DIR, 'serve.json'));

const PORT = Number(process.env.PORT) || 5500;

function redirect(res, location, statusCode = 301) {
  res.statusCode = statusCode;
  res.setHeader('Location', location);
  res.end();
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;

  // Canonical trailing slash rules (match production expectations)
  if (pathname === '/projects') return redirect(res, '/projects/');
  if (pathname === '/hobbies') return redirect(res, '/hobbies/');

  // /hobbies-games is canonical WITHOUT trailing slash
  if (pathname === '/hobbies-games/') return redirect(res, '/hobbies-games');

  try {
    await handler(req, res, config);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Serving on http://localhost:${PORT}`);
});
