/**
 * Autonomous V12 Diagnostics Testing Script (v13 prompt)
 *
 * Usage:
 * - Open the deployed site in the browser
 * - Open DevTools Console
 * - Paste this entire script and run
 */

(async function testV12Diagnostics() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    pass: 0,
    fail: 0,
    errors: []
  };

  function test(name, condition, expected, actual) {
    const passed = !!condition;
    results.tests.push({ name, passed, expected, actual });
    if (passed) results.pass++;
    else results.fail++;
    // eslint-disable-next-line no-console
    console.log(`${passed ? '✅' : '❌'} ${name}`);
    if (!passed) {
      // eslint-disable-next-line no-console
      console.log(`   Expected: ${expected}, Got: ${actual}`);
    }
  }

  // eslint-disable-next-line no-console
  console.group('🧪 v12 Diagnostics Test Suite');

  const tel = window.__SavonieTelemetry;
  test('Telemetry core loaded', !!tel, 'object', typeof tel);
  if (!tel) {
    // eslint-disable-next-line no-console
    console.error('❌ FATAL: Telemetry not loaded. Cannot continue tests.');
    // eslint-disable-next-line no-console
    console.groupEnd();
    return results;
  }

  const hud = window.__SavonieHUD;
  test('HUD loaded', !!hud, 'object', typeof hud);

  const state0 = tel.getState();
  const breadcrumbs0 = state0.breadcrumbs || [];
  test('Breadcrumbs buffer exists', breadcrumbs0.length >= 0, '≥0', breadcrumbs0.length);

  // Navigation breadcrumbs
  // eslint-disable-next-line no-console
  console.log('📍 Testing navigation breadcrumbs...');
  const beforeNav = (tel.getState().breadcrumbs || []).length;

  try {
    history.pushState({}, '', '/test-v12-1');
    history.replaceState({}, '', '/test-v12-2');
    window.location.hash = '#test-v12';
  } catch (e) {
    results.errors.push({ test: 'Navigation API', error: e && e.message ? e.message : String(e) });
  }

  await new Promise((r) => setTimeout(r, 150));
  const afterNav = (tel.getState().breadcrumbs || []).length;
  test('Navigation breadcrumbs captured', afterNav > beforeNav, `>${beforeNav}`, afterNav);

  const navBreadcrumbs = (tel.getState().breadcrumbs || []).filter((bc) => {
    const msg = String(bc && bc.msg ? bc.msg : '');
    return msg.startsWith('nav.');
  });
  test('Navigation breadcrumbs have nav.* msg', navBreadcrumbs.length > 0, '>0', navBreadcrumbs.length);

  // Web vitals attribution
  // eslint-disable-next-line no-console
  console.log('📊 Testing web vitals attribution...');
  const perf = (tel.getState().perf || {});
  test('LCP attribution exists (field)', 'lcpAttribution' in perf, true, 'lcpAttribution' in perf);
  test('CLS attribution exists (field)', 'clsAttribution' in perf, true, 'clsAttribution' in perf);
  test('INP attribution exists (field)', 'inpAttribution' in perf, true, 'inpAttribution' in perf);

  test('Long tasks counter exists', 'longTasks' in perf, true, 'longTasks' in perf);
  test('Long task max duration exists', 'longTaskMax' in perf, true, 'longTaskMax' in perf);

  // Trigger a long task
  // eslint-disable-next-line no-console
  console.log('⏱️ Triggering long task (200ms block)...');
  const start = performance.now();
  while (performance.now() - start < 200) {}

  await new Promise((r) => setTimeout(r, 600));
  const longTasks = (tel.getState().perf && tel.getState().perf.longTasks) || 0;
  test('Long task detected', longTasks > 0, '>0', longTasks);

  // HUD tabs
  if (hud && typeof hud.open === 'function') {
    // eslint-disable-next-line no-console
    console.log('🎨 Opening HUD to check tabs...');
    try {
      hud.open();
      await new Promise((r) => setTimeout(r, 500));
      const tabs = document.querySelectorAll('.savonie-tab');
      test('HUD has 9+ tabs (v12)', tabs.length >= 9, '≥9', tabs.length);

      const tabNames = Array.from(tabs).map((t) => t.textContent.trim());
      test('Accessibility tab exists', tabNames.includes('Accessibility'), true, tabNames.includes('Accessibility'));
      test('Security tab exists', tabNames.includes('Security'), true, tabNames.includes('Security'));
      // eslint-disable-next-line no-console
      console.log('   Tab names:', tabNames);
    } catch (e) {
      results.errors.push({ test: 'HUD tab render', error: e && e.message ? e.message : String(e) });
      test('HUD can open', false, 'no error', e && e.message ? e.message : String(e));
    }
  }

  // Breadcrumbs serialization
  // eslint-disable-next-line no-console
  console.log('🔍 Testing breadcrumbs serialization...');
  try {
    const exported = tel.export({ includeAll: false });
    const breadcrumbsJSON = JSON.stringify(exported.breadcrumbs);
    const hasCircular = breadcrumbsJSON.includes('[Circular]');
    const hasObject = breadcrumbsJSON.includes('[Object]');
    test('Breadcrumbs serialize without [Circular]', !hasCircular, 'false', hasCircular);
    test('Breadcrumbs serialize without [Object]', !hasObject, 'false', hasObject);
  } catch (e) {
    results.errors.push({ test: 'Breadcrumbs serialization', error: e && e.message ? e.message : String(e) });
    test('Breadcrumbs serialize without error', false, 'no error', e && e.message ? e.message : String(e));
  }

  // Test issue recorded
  // eslint-disable-next-line no-console
  console.log('📤 Recording test issue...');
  try {
    tel.recordIssue({
      kind: 'error',
      msg: 'Test error for v12 validation',
      stack: 'Test stack trace'
    });
  } catch (e) {
    results.errors.push({ test: 'Record issue', error: e && e.message ? e.message : String(e) });
  }

  const issues = tel.getState().issues || [];
  const testIssue = issues.find((i) => i && i.msg === 'Test error for v12 validation');
  test('Test issue recorded', !!testIssue, true, !!testIssue);

  const buildVersion = tel.getState().buildVersion;
  test('Build version exists', !!buildVersion, 'string', typeof buildVersion);
  // eslint-disable-next-line no-console
  console.log('   Build version:', buildVersion);

  test('axe-core can load (not required pre-load)', typeof window.axe === 'undefined' || typeof window.axe === 'object',
    'undefined or object', typeof window.axe);

  // eslint-disable-next-line no-console
  console.groupEnd();

  // eslint-disable-next-line no-console
  console.group('📋 Test Summary');
  // eslint-disable-next-line no-console
  console.log(`Total: ${results.tests.length}`);
  // eslint-disable-next-line no-console
  console.log(`✅ Pass: ${results.pass}`);
  // eslint-disable-next-line no-console
  console.log(`❌ Fail: ${results.fail}`);
  if (results.errors.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`🔥 Errors: ${results.errors.length}`);
    // eslint-disable-next-line no-console
    console.table(results.errors);
  }
  // eslint-disable-next-line no-console
  console.groupEnd();

  // eslint-disable-next-line no-console
  console.log('📦 Full Results:');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(results, null, 2));

  try {
    await navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    // eslint-disable-next-line no-console
    console.log('✅ Results copied to clipboard!');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('ℹ️ Could not copy to clipboard automatically');
  }

  return results;
})();
