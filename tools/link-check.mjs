#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function tryReadText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function resolveInventoryPath(input) {
  const p = String(input ?? '').trim();
  if (!p) return null;

  // If it looks like a JSON path, use as-is.
  if (p.toLowerCase().endsWith('.json')) {
    return p;
  }

  // If it's a directory, require inventory.json inside.
  try {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      const candidate = path.join(p, 'inventory.json');
      if (existsSyncFile(candidate)) return candidate;
      return { error: `STOP: inventory directory missing inventory.json at ${candidate}` };
    }

    // If it's a file (ex: .reports/_latest), treat as RUN_ID pointer.
    if (st.isFile()) {
      const txt = tryReadText(p);
      const runId = String(txt ?? '').trim();
      if (!runId) return { error: `STOP: inventory pointer file is empty: ${p}` };
      const pointerDir = path.dirname(p);
      // If the pointer file itself lives inside .reports/<RUN_ID>/, don't nest another <RUN_ID>/.
      // Example: .reports/<RUN_ID>/_tmp_latest containing <RUN_ID> should resolve to .reports/<RUN_ID>/inventory.json.
      const candidate =
        path.basename(pointerDir) === runId
          ? path.join(pointerDir, 'inventory.json')
          : path.join(pointerDir, runId, 'inventory.json');
      if (existsSyncFile(candidate)) return candidate;
      return { error: `STOP: inventory pointer did not resolve to an existing file: ${candidate}` };
    }
  } catch {
    // fall through
  }

  return { error: `STOP: cannot resolve --inventory input: ${p}` };
}

function resolveOutDir(outDir, inventoryArg) {
  const p = String(outDir ?? '').trim();
  if (!p) return null;

  // If outDir is a pointer file, resolve to .reports/<RUN_ID>
  try {
    const st = fs.statSync(p);
    if (st.isFile()) {
      const txt = tryReadText(p);
      const runId = String(txt ?? '').trim();
      if (!runId) return { error: `STOP: outDir pointer file is empty: ${p}` };
      const pointerDir = path.dirname(p);
      // Same rule as inventory: if pointer file is already inside .reports/<RUN_ID>/, resolve to that directory.
      return path.basename(pointerDir) === runId ? pointerDir : path.join(pointerDir, runId);
    }
  } catch {
    // ignore
  }

  // If outDir doesn't exist yet, allow creating it.
  return p;
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function normalizeSlash(p) {
  return p.replaceAll('\\', '/');
}

function normalizeRoutePath(p) {
  let s = String(p ?? '').trim();
  if (!s) return '';
  s = stripHashAndQuery(s);
  // Keep leading slash for URL paths.
  if (!s.startsWith('/')) s = '/' + s;
  // Canonicalize trailing slash except root.
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

function compileRouteMatcher(route) {
  const r = normalizeRoutePath(route);
  if (!r) return null;

  // Exact routes: no globs or params.
  if (!r.includes('*') && !r.includes(':')) {
    return { kind: 'exact', route: r };
  }

  // Pattern routes: support `*` and `:param` segments.
  let src = r
    .replace(/[\\.^$+?()[\]{}|]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/:(\w+)/g, '[^/]+');

  // Allow optional trailing slash.
  src = `^${src}/?$`;
  return { kind: 'regex', route: r, re: new RegExp(src) };
}

function routeMatches(routeExact, routeRegex, urlPath) {
  const raw = String(urlPath ?? '').trim();
  if (!raw) return false;
  const normalized = normalizeRoutePath(raw);
  if (!normalized) return false;
  if (routeExact.has(normalized)) return true;

  const rawPath = (() => {
    let s = stripHashAndQuery(raw);
    if (!s.startsWith('/')) s = '/' + s;
    return s;
  })();

  for (const m of routeRegex) {
    if (m.re.test(rawPath)) return true;
  }
  return false;
}

function stripHashAndQuery(urlLike) {
  const hashIdx = urlLike.indexOf('#');
  const qIdx = urlLike.indexOf('?');
  let end = urlLike.length;
  if (hashIdx >= 0) end = Math.min(end, hashIdx);
  if (qIdx >= 0) end = Math.min(end, qIdx);
  return urlLike.slice(0, end);
}

function isSchemeLink(href) {
  const h = href.toLowerCase();
  return (
    h.startsWith('http:') ||
    h.startsWith('https:') ||
    h.startsWith('mailto:') ||
    h.startsWith('tel:') ||
    h.startsWith('javascript:')
  );
}

function isSkippableLink(href) {
  if (!href) return true;
  const t = href.trim();
  if (!t) return true;
  if (t.startsWith('#')) return true;
  // Ignore other schemes entirely for existence checks.
  if (isSchemeLink(t)) return true;
  if (t.startsWith('data:') || t.startsWith('blob:')) return true;
  return false;
}

function isKnownLocaleRoute(absHref) {
  const raw = String(absHref ?? '').trim();
  if (!raw.startsWith('/')) return false;
  const p = stripHashAndQuery(raw).toLowerCase();
  return p.startsWith('/ar/') || p.startsWith('/es/');
}

function joinUrlPath(baseDir, rel) {
  // rel may include query/hash. Caller should preserve original for reporting.
  const clean = stripHashAndQuery(rel);
  const decoded = safeDecode(clean);
  const resolved = path.resolve(baseDir, decoded);
  return resolved;
}

function toFileCandidateFromAbsHref(repoRoot, absHref) {
  // absHref starts with '/'
  const clean = safeDecode(stripHashAndQuery(absHref));
  let p = clean;
  if (p === '/') p = '/index.html';
  if (p.endsWith('/')) p = `${p}index.html`;
  return path.join(repoRoot, p.replace(/^[\/]+/, ''));
}

function toFileCandidateFromRelHref(fileDir, relHref) {
  const clean = safeDecode(stripHashAndQuery(relHref));
  let p = clean;
  if (p.endsWith('/')) p = `${p}index.html`;
  return path.resolve(fileDir, p);
}

function parseAttributes(tagText) {
  const attrs = {};
  const re = /([A-Za-z_:][A-Za-z0-9_:\-\.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(tagText)) !== null) {
    const key = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    attrs[key] = value;
  }
  return attrs;
}

function collectLinksFromHtml(html) {
  const out = [];
  const tagRe = /<(a|link|script)\b[^>]*>/gi;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const tagName = m[1].toLowerCase();
    const tagText = m[0];
    const attrs = parseAttributes(tagText);

    if (tagName === 'a') {
      if (!('href' in attrs)) continue;
      out.push({
        kind: 'a',
        url: attrs.href,
        target: attrs.target ?? '',
        rel: attrs.rel ?? '',
        rawTag: tagText,
      });
      continue;
    }

    if (tagName === 'link') {
      if (!('href' in attrs)) continue;
      out.push({ kind: 'link', url: attrs.href, rawTag: tagText });
      continue;
    }

    if (tagName === 'script') {
      if (!('src' in attrs)) continue;
      out.push({ kind: 'script', url: attrs.src, rawTag: tagText });
      continue;
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inventoryArg = args.inventory;
  const outDirArg = args.outDir;

  if (!inventoryArg || !outDirArg) {
    process.stderr.write(
      'Usage: node tools/link-check.mjs --inventory <path> --outDir <dir>\n' +
        'Exit 4 if inputs are missing or inventory schema invalid.\n'
    );
    process.exit(4);
  }

  const resolvedInventory = resolveInventoryPath(inventoryArg);
  if (!resolvedInventory) {
    process.stderr.write('STOP: cannot resolve inventory input\n');
    process.exit(4);
  }
  if (typeof resolvedInventory === 'object' && resolvedInventory.error) {
    process.stderr.write(`${resolvedInventory.error}\n`);
    process.exit(4);
  }

  const resolvedOutDir = resolveOutDir(outDirArg, inventoryArg);
  if (!resolvedOutDir) {
    process.stderr.write('STOP: cannot resolve outDir input\n');
    process.exit(4);
  }
  if (typeof resolvedOutDir === 'object' && resolvedOutDir.error) {
    process.stderr.write(`${resolvedOutDir.error}\n`);
    process.exit(4);
  }

  const inventoryPath = resolvedInventory;
  const outDir = resolvedOutDir;

  // Minimal, stable diagnostics for receipt/proofing.
  process.stdout.write(`resolvedInventory=${normalizeSlash(path.resolve(process.cwd(), inventoryPath))}\n`);
  process.stdout.write(`resolvedOutDir=${normalizeSlash(path.resolve(process.cwd(), outDir))}\n`);

  let inv;
  try {
    inv = readJson(inventoryPath);
  } catch {
    process.stderr.write(`STOP: cannot read inventory at ${inventoryPath}\n`);
    process.exit(4);
  }

  const servedHtmlTargets = inv?.servedHtmlTargets;
  if (!Array.isArray(servedHtmlTargets) || servedHtmlTargets.length === 0) {
    process.stderr.write('STOP: inventory missing servedHtmlTargets (non-empty array required)\n');
    process.exit(4);
  }

  const servedRoutes = Array.isArray(inv?.servedRoutes) ? inv.servedRoutes : [];
  const redirects = Array.isArray(inv?.redirects) ? inv.redirects : [];

  const routeExact = new Set();
  const routeRegex = [];

  function addRouteCandidate(route) {
    if (typeof route !== 'string') return;
    const m = compileRouteMatcher(route);
    if (!m) return;
    if (m.kind === 'exact') {
      routeExact.add(m.route);
      return;
    }
    routeRegex.push(m);
  }

  for (const r of servedRoutes) {
    if (typeof r === 'string') {
      addRouteCandidate(r);
      continue;
    }
    if (r && typeof r === 'object' && typeof r.route === 'string') {
      addRouteCandidate(r.route);
    }
  }

  for (const r of redirects) {
    const from = r?.from;
    if (typeof from === 'string') addRouteCandidate(from);
  }

  const repoRoot = process.cwd();

  const internalMissing = [];
  const externalRelErrors = [];
  let checkedLinks = 0;

  for (const relPath of servedHtmlTargets) {
    if (typeof relPath !== 'string' || !relPath.trim()) continue;

    const filePath = path.resolve(repoRoot, relPath);
    let html;
    try {
      html = fs.readFileSync(filePath, 'utf8');
    } catch {
      internalMissing.push({
        sourceFile: normalizeSlash(relPath),
        url: '(servedHtmlTargets entry)',
        resolvedPath: normalizeSlash(relPath),
        reason: 'servedHtmlTargets file missing on disk',
      });
      continue;
    }

    const fileDir = path.dirname(filePath);
    const links = collectLinksFromHtml(html);

    for (const link of links) {
      const raw = (link.url ?? '').trim();
      if (isSkippableLink(raw)) continue;

      checkedLinks++;

      const isExternal = raw.toLowerCase().startsWith('http:') || raw.toLowerCase().startsWith('https:') || raw.startsWith('//');

      if (isExternal) {
        if (link.kind === 'a' && String(link.target).toLowerCase() === '_blank') {
          const rel = String(link.rel ?? '').toLowerCase();
          const hasNoopener = rel.split(/\s+/).includes('noopener');
          const hasNoreferrer = rel.split(/\s+/).includes('noreferrer');
          if (!hasNoopener || !hasNoreferrer) {
            externalRelErrors.push({
              sourceFile: normalizeSlash(relPath),
              url: raw,
              requirement: 'target="_blank" requires rel="noopener noreferrer"',
              rel: String(link.rel ?? ''),
            });
          }
        }
        continue;
      }

      const withoutHash = stripHashAndQuery(raw);

      if (withoutHash.startsWith('/')) {
        // Absolute internal
        if (isKnownLocaleRoute(withoutHash)) {
          continue;
        }

        if (routeMatches(routeExact, routeRegex, withoutHash)) {
          continue;
        }

        const baseCandidate = toFileCandidateFromAbsHref(repoRoot, withoutHash);
        const candidates = [baseCandidate];
        // If clean-url style path, also try common file variants.
        if (!path.extname(stripHashAndQuery(withoutHash))) {
          candidates.push(baseCandidate + '.html');
          candidates.push(path.join(baseCandidate, 'index.html'));
        }

        const fileCandidate = candidates.find((c) => existsSyncFile(c));
        if (fileCandidate) {
          continue;
        }

        internalMissing.push({
          sourceFile: normalizeSlash(relPath),
          url: raw,
          resolvedPath: normalizeSlash(path.relative(repoRoot, baseCandidate)),
          reason: 'absolute internal link not found as served route/redirect source or file',
        });
        continue;
      }

      // Relative internal
      const baseCandidate = toFileCandidateFromRelHref(fileDir, withoutHash);
      const candidates = [baseCandidate];
      if (!path.extname(stripHashAndQuery(withoutHash))) {
        candidates.push(baseCandidate + '.html');
        candidates.push(path.join(baseCandidate, 'index.html'));
      }
      const fileCandidate = candidates.find((c) => existsSyncFile(c));
      if (fileCandidate) {
        continue;
      }

      internalMissing.push({
        sourceFile: normalizeSlash(relPath),
        url: raw,
        resolvedPath: normalizeSlash(path.relative(repoRoot, baseCandidate)),
        reason: 'relative link target missing on disk',
      });
    }
  }

  const findings = {
    inventory: normalizeSlash(inventoryPath),
    servedHtmlTargetsCount: servedHtmlTargets.length,
    checkedLinks,
    internalMissingCount: internalMissing.length,
    externalRelErrorsCount: externalRelErrors.length,
    internalMissing,
    externalRelErrors,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'prompt5.links.json'), `${JSON.stringify(findings, null, 2)}\n`, 'utf8');

  const lines = [];
  lines.push(`inventory: ${findings.inventory}`);
  lines.push(`servedHtmlTargets: ${findings.servedHtmlTargetsCount}`);
  lines.push(`checkedLinks: ${findings.checkedLinks}`);
  lines.push(`internalMissing: ${findings.internalMissingCount}`);
  lines.push(`externalRelErrors: ${findings.externalRelErrorsCount}`);
  lines.push('');

  if (internalMissing.length) {
    lines.push('Missing internal links:');
    for (const m of internalMissing) {
      lines.push(`- ${m.sourceFile} :: ${m.url} -> ${m.resolvedPath}`);
    }
    lines.push('');
  }

  if (externalRelErrors.length) {
    lines.push('External rel errors:');
    for (const e of externalRelErrors) {
      lines.push(`- ${e.sourceFile} :: ${e.url} (rel="${e.rel}")`);
    }
    lines.push('');
  }

  fs.writeFileSync(path.join(outDir, 'prompt5.links.txt'), `${lines.join('\n')}\n`, 'utf8');

  if (internalMissing.length) process.exit(2);
  if (externalRelErrors.length) process.exit(3);
  process.exit(0);
}

function existsSyncFile(p) {
  try {
    const st = fs.statSync(p);
    return st.isFile();
  } catch {
    return false;
  }
}

main();
