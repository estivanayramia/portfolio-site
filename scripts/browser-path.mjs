export function getBrowserLaunchConfig() {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || null;
  const isCI = !!process.env.CI;
  
  if (process.cwd().includes('puppeteer-core') && isCI && !executablePath) {
    console.error('Error: Using puppeteer-core in CI requires PUPPETEER_EXECUTABLE_PATH or CHROME_PATH.');
    process.exit(1);
  }

  const args = [];
  if (isCI) {
    args.push('--no-sandbox');
    args.push('--disable-setuid-sandbox');
  }

  return {
    executablePath, // null/undefined lets puppeteer use bundled if available
    args
  };
}
