import assert from 'node:assert/strict';
import test from 'node:test';

import { isCritical } from '../tools/audit-sw-version.mjs';

test('service-worker version audit ignores non-deployable support code', () => {
  for (const file of [
    'tests/site-wide-controls.spec.js',
    'scripts/local-serve.js',
    'tools/stamp-build-version.mjs',
    'docs/guides/testing.md',
    '.github/workflows/ci.yml',
    'sw.js',
  ]) {
    assert.equal(isCritical(file), false, `${file} must not require a cache bump`);
  }
});

test('service-worker version audit includes deployable routes and assets', () => {
  for (const file of [
    'index.html',
    'EN/hobbies/car.html',
    'theme.css',
    'assets/css/components/luxury-coverflow.css',
    'assets/js/site.js',
    'worker/worker.mjs',
    'assets/data/chat-page-manifest.json',
    'assets/img/logo-ea.webp',
    'assets/fonts/inter/inter-latin.woff2',
    '_redirects',
    '_headers',
  ]) {
    assert.equal(isCritical(file), true, `${file} must require a cache bump`);
  }
});

test('service-worker version audit normalizes Windows paths', () => {
  assert.equal(isCritical('assets\\js\\site.js'), true);
  assert.equal(isCritical('tests\\site-wide-controls.spec.js'), false);
});
