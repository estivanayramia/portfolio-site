import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { transform } from 'lightningcss';

const THEME_FILES = ['theme.css', 'assets/css/theme.css'];

for (const file of THEME_FILES) {
  test(`${file} parses and keeps mobile chat rules inside the mobile query`, () => {
    const css = fs.readFileSync(file, 'utf8');

    assert.doesNotThrow(() => {
      transform({
        filename: file,
        code: Buffer.from(css),
        minify: false,
        sourceMap: false,
      });
    });

    const mobileStart = css.indexOf('/* Mobile chat widget adjustments */');
    const nextSection = css.indexOf('/* Style links in bot messages', mobileStart);
    assert.notEqual(mobileStart, -1, `${file} must contain the mobile chat section`);
    assert.notEqual(nextSection, -1, `${file} must close the mobile section before link styles`);

    const mobileSection = css.slice(mobileStart, nextSection);
    assert.match(mobileSection, /@media\s*\(max-width:\s*640px\)/);
    assert.match(mobileSection, /#welcome-bubble/);
    assert.match(mobileSection, /body\.chat-open/);
  });
}
