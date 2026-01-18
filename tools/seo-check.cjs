/* Temporary local SEO validation script (delete before committing).
   Usage:
     node tools/seo-check.cjs
*/

'use strict';

const fs = require('fs');

const expected = {
  pages: [
    {
      file: 'index.html',
      title: 'Estivan Ayramia | Portfolio',
      desc: 'Estivan Ayramia. General Business student at San Diego State University (SDSU) building operations systems, playbooks, and documentation. Portfolio.',
    },
    {
      file: 'projects.html',
      title: 'Estivan Ayramia | Projects',
      desc: 'Selected projects by Estivan Ayramia: operations systems, process improvement, logistics, and documentation. Results, writeups, and what changed.',
    },
    {
      file: 'overview.html',
      title: 'Estivan Ayramia | Overview',
      desc: 'Quick overview of Estivan Ayramia: focus areas, strengths, and highlights across operations, systems building, and execution.',
    },
    {
      file: 'deep-dive.html',
      title: 'Estivan Ayramia | Deep Dive',
      desc: 'Deep project breakdowns: decisions, tradeoffs, implementation notes, and outcomes. By Estivan Ayramia.',
    },
    {
      file: 'about.html',
      title: 'Estivan Ayramia | About',
      desc: 'About Estivan Ayramia, a General Business student at San Diego State University (SDSU) focused on operations, systems thinking, and execution.',
    },
    {
      file: 'contact.html',
      title: 'Estivan Ayramia | Contact',
      desc: 'Contact Estivan Ayramia for internships, collaboration, or consulting. Email and LinkedIn.',
    },
    {
      file: 'privacy.html',
      title: 'Estivan Ayramia | Privacy Policy',
      desc: 'Privacy policy for estivanayramia.com: what data is collected, how it is used, and how it is protected.',
    },
  ],
  noindex: ['404.html'],
};

function getMatch(re, html) {
  const m = re.exec(html);
  return m ? m[1] : null;
}

function countMatches(re, html) {
  const m = html.match(re);
  return m ? m.length : 0;
}

function fail(out, file, msg) {
  out.ok = false;
  out.failures.push({ file, msg });
}

function readFile(file) {
  return fs.readFileSync(file, 'utf8');
}

function normalizeRobots(str) {
  return String(str || '').toLowerCase();
}

function main() {
  const out = { ok: true, failures: [] };

  for (const p of expected.pages) {
    const html = readFile(p.file);

    // Canonical / og:url integrity (as-is)
    const canonicalTagCount = countMatches(
      /<link[^>]+rel=['\"]canonical['\"][^>]*>/gi,
      html,
    );
    if (canonicalTagCount !== 1) {
      fail(out, p.file, `canonical count ${canonicalTagCount}`);
    }

    const canonical = getMatch(
      /<link[^>]+rel=['\"]canonical['\"][^>]*href=['\"]([^'\"]+)['\"]/i,
      html,
    );
    const ogUrl = getMatch(
      /<meta[^>]+property=['\"]og:url['\"][^>]*content=['\"]([^'\"]+)['\"]/i,
      html,
    );

    if (canonical !== ogUrl) {
      fail(out, p.file, `og:url must equal canonical (canonical=${canonical}, og:url=${ogUrl})`);
    }

    // Titles / descriptions
    const title = getMatch(/<title>([^<]*)<\/title>/i, html);
    if (title !== p.title) {
      fail(out, p.file, `title mismatch: ${title}`);
    }

    const desc = getMatch(
      /<meta[^>]+name=['\"]description['\"][^>]*content=['\"]([^'\"]+)['\"]/i,
      html,
    );
    if (desc !== p.desc) {
      fail(out, p.file, `description mismatch: ${desc}`);
    }

    const ogTitle = getMatch(
      /<meta[^>]+property=['\"]og:title['\"][^>]*content=['\"]([^'\"]+)['\"]/i,
      html,
    );
    const ogDesc = getMatch(
      /<meta[^>]+property=['\"]og:description['\"][^>]*content=['\"]([^'\"]+)['\"]/i,
      html,
    );
    const twTitle = getMatch(
      /<meta[^>]+name=['\"]twitter:title['\"][^>]*content=['\"]([^'\"]+)['\"]/i,
      html,
    );
    const twDesc = getMatch(
      /<meta[^>]+name=['\"]twitter:description['\"][^>]*content=['\"]([^'\"]+)['\"]/i,
      html,
    );

    if (ogTitle !== p.title) {
      fail(out, p.file, `og:title mismatch: ${ogTitle}`);
    }
    if (ogDesc !== p.desc) {
      fail(out, p.file, `og:description mismatch: ${ogDesc}`);
    }
    if (twTitle !== p.title) {
      fail(out, p.file, `twitter:title mismatch: ${twTitle}`);
    }
    if (twDesc !== p.desc) {
      fail(out, p.file, `twitter:description mismatch: ${twDesc}`);
    }

    const ogSiteName = getMatch(
      /<meta[^>]+property=['\"]og:site_name['\"][^>]*content=['\"]([^'\"]+)['\"]/i,
      html,
    );
    if (ogSiteName !== 'Estivan Ayramia') {
      fail(out, p.file, `og:site_name missing/mismatch: ${ogSiteName}`);
    }

    // data-print-title (if present)
    const bodyPrintTitle = getMatch(
      /<body[^>]*data-print-title=['\"]([^'\"]+)['\"]/i,
      html,
    );
    if (bodyPrintTitle !== null && bodyPrintTitle !== p.title) {
      fail(out, p.file, `data-print-title mismatch: ${bodyPrintTitle}`);
    }
  }

  for (const file of expected.noindex) {
    const html = readFile(file);

    const robots = getMatch(
      /<meta[^>]+name=['\"]robots['\"][^>]*content=['\"]([^'\"]+)['\"]/i,
      html,
    );
    if (robots === null) {
      fail(out, file, 'robots missing');
    } else {
      const r = normalizeRobots(robots);
      if (r.indexOf('noindex') === -1) {
        fail(out, file, `robots missing noindex: ${robots}`);
      }
      if (r.indexOf('nofollow') === -1) {
        fail(out, file, `robots missing nofollow: ${robots}`);
      }
    }

    const canonicalTagCount = countMatches(
      /<link[^>]+rel=['\"]canonical['\"][^>]*>/gi,
      html,
    );
    if (canonicalTagCount !== 0) {
      fail(out, file, `canonical present (${canonicalTagCount})`);
    }

    const ogUrlCount = countMatches(
      /<meta[^>]+property=['\"]og:url['\"]/gi,
      html,
    );
    if (ogUrlCount !== 0) {
      fail(out, file, `og:url present (${ogUrlCount})`);
    }
  }

  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main();
