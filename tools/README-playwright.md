Playwright WebKit Debug Runner
================================

Quick steps to run the debug runner on Windows (from the repo root):

1. Install Playwright and WebKit browsers:

```powershell
npm install --save-dev playwright
npx playwright install webkit
```

2. Run the runner (headed WebKit will open and emulate iPhone 13):

```powershell
npm run debug:playwright -- https://estivanayramia.com
```

3. Outputs saved to project root after the run:
- `playwright-debug-log.json` — JSON events and sampled scroll positions
- `playwright-debug-screenshot.png` — full page screenshot

Notes:
- The script opens a headed WebKit window so you can also manually interact while it records.
- If the script does not reproduce the jump, try manually scrolling while the window is open; the script leaves the page open briefly for that purpose.
- If Playwright does not reproduce the behavior, the issue may be specific to Safari on a real device; we can try `ios-webkit-debug-proxy` or add a temporary server-side logger next.
