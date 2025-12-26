# Image Assets

This folder contains site icons and branding assets. For best results, use high-contrast images. Safari pinned tab uses a monochrome SVG mask.

## Required Files
- `favicon.ico` - Windows/legacy browsers fallback.
- `favicon-16x16.png` - Small PNG icon.
- `favicon-32x32.png` - Standard PNG icon.
- `apple-touch-icon.png` - iOS home screen icon (180x180).
- `safari-pinned-tab.svg` - Safari pinned tab mask (black-only vector).
- `logo-ea.png` - Sitewide brand logo.

## Notes
- Safari pinned tab SVG should be solid black shapes only; the color is applied via the HTML `<link rel="mask-icon" color="#212842">` attribute.
- Keep icons square and centered with safe padding for crisp rendering.
- If you update icons, run the deployment script to bump the service worker version so clients receive updates.
