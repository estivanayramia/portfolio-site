# Portfolio Website

Static multilingual portfolio built with HTML, Tailwind CSS, GSAP, and modern web standards. Installable as a PWA with offline support.

## 🚀 Features

- **PWA Support**: Installable app with offline functionality via service worker
- **Time-Budget Navigation**: 30-second, 1-minute, and 5-minute content paths
- **Multilingual**: English, Spanish (ES), Arabic (AR) with RTL support
- **Analytics**: Google Analytics 4 + Microsoft Clarity with comprehensive event tracking
- **AI Chatbot**: Custom Savonie AI chatbot with Smart Signals (chips, actions, project cards)
- **Performance Monitoring**: Automatic Core Web Vitals tracking (LCP, FID, CLS)
- **Achievement System**: 8 hidden achievements to boost engagement
- **Easter Eggs**: Konami code secret (↑↑↓↓←→←→BA)
- **Accessibility**: WCAG 2.1 AA compliant
- **Animations**: GSAP-powered scroll animations
- **Security**: CSP headers, X-Frame-Options, secure cache policies
- **Dark Mode**: Polished dark theme with optimized chat widget styling

## 🛠️ Development

### Local Server (Clean URLs)
To test the site locally with clean URLs (e.g., `/projects` instead of `/projects.html`), run:

```bash
npm start
```

This uses `serve` with `cleanUrls: true` to mimic production routing.

---

## 🤖 Savonie AI Chatbot

### Smart Signals Integration
The chatbot now supports advanced interactions via JSON responses from the backend:

**Response Format:**
```json
{
  "reply": "Text response with markdown support",
  "chips": ["Suggestion 1", "Suggestion 2"],
  "action": "download_resume" | "email_link",
  "card": "logistics" | "conflict" | "discipline" | "website"
}
```

**Features:**
- **Typewriter Effect**: Bot messages type out character-by-character (30ms delay)
- **Dynamic Chips**: Suggestion buttons that auto-populate and send messages
- **Smart Actions**: 
  - `download_resume`: Triggers PDF download
  - `email_link`: Opens mailto link
- **Project Cards**: Visual cards with images and "View Project" buttons
- **Language Detection**: Automatically sends page language to backend
- **Google Analytics**: Tracks chat interactions with `chat_question` events
- **Session Persistence**: Chat history saved in sessionStorage
- **Draggable Window**: Repositionable with viewport constraints
- **Keyboard Shortcuts**: 
  - `Escape` to close
  - `Ctrl/Cmd + K` to toggle
- **Dark Mode Optimized**: Premium gradients, hidden scrollbars, glassmorphism effects

### Project Data
Available project cards:
- `logistics`: Logistics System
- `conflict`: Conflict Playbook
- `discipline`: Discipline Routine
- `website`: Portfolio Website

---

## 🔔 Recent Changes (Latest Commit)

### Mobile Responsiveness Optimization
- **Typography Scaling**: Stat numbers now use `text-3xl sm:text-4xl md:text-5xl` for mobile-friendly sizing
- **Chat Widget Mobile**: Fully responsive with viewport-aware sizing and positioning
- **Color Consistency**: Force brand colors on mobile devices (prevents OS dark mode override)
- **Mobile Menu**: Enhanced with smooth animations and icon rotation
- **Touch Optimization**: Larger touch targets (56px buttons) and comfortable padding
- **Analytics Verified**: Google Analytics 4 and Microsoft Clarity confirmed in `<head>` for mobile tracking

### Chatbot Migration: Chatbase → Savonie AI
- **Complete Replacement**: Removed all Chatbase scripts and code
- **Custom Implementation**: Built serverless chatbot with Cloudflare Worker backend
- **Smart Signals**: Added JSON-based response handling with chips, actions, and cards
- **Enhanced UX**: 
  - Typewriter effect for bot responses
  - Auto-scroll to bottom on load and toggle
  - Mobile menu fix (click-to-toggle instead of hold)
  - Suggestion chips removed from static HTML (now dynamic)
  
### Dark Mode Improvements
- **Premium Styling**: Gradient backgrounds, glassmorphism, enhanced shadows
- **Hidden Scrollbars**: Cleaner interface without visible scrollbars
- **Optimized Colors**: Light text on user messages for better readability
- **Consistent Theme**: All chat elements styled to match site's dark mode

### Analytics Enhancement
- **Google Analytics**: Chat question tracking integrated
- **Microsoft Clarity**: Already configured for session recording

---

## 🔔 Previous Changes

These changes were made to finalize branding and PWA/favicon support before you commit and deploy. Follow the short checklist below before pushing to `main`.

- Added comprehensive favicon references across pages (`index.html`, `about.html`, `projects.html`, `contact.html`, `privacy.html`, `deep-dive.html`, `overview.html`, `404.html`).
- Created `assets/img/README.md` with instructions on required icon files.
- Created `assets/img/safari-pinned-tab.svg` (monochrome mask-ready pinned tab for Safari).
- Replaced header home icon / "Portfolio" text with `logo-ea.png` references across pages (place the real `logo-ea.png` in `/assets/img/`).
- Removed `blog.html` and cleaned navigation links (blog removed by request).
- PWA/service worker is wired for aggressive updates; there are deployment scripts to bump the SW version before publish.

Required assets to upload before commit (place these under `assets/img/` unless noted):

- `logo-ea.png` - site logo used across header/hero/footer.
- `favicon-32x32.png`, `favicon-16x16.png`, `favicon.ico`, `apple-touch-icon.png`, `safari-pinned-tab.svg` (the last is already added).
- `assets/docs/Estivan-Ayramia-Resume.pdf` - resume PDF (you'll upload this later; links/buttons already in place).

Pre-commit checklist (quick):

1. Add the assets listed above to `assets/img/` and `assets/docs/`.
2. Run the local service worker bump script (updates SW version so clients refresh):

```powershell
.\bump-sw-version.ps1
# or the batch variant:
.\bump-sw-version.bat
```

3. Commit your changes locally:

```powershell
git add .
git commit -m "Branding: add favicons, safari pinned tab, logo; prep resume"
```

4. Deploy (push to origin/main and run deploy script if you use the local deploy helper):

```powershell
git push origin main
# then, if you want the repo helper to further run deploy steps:
.\deploy.ps1
# or batch: .\deploy.bat
```

Notes:

- The `safari-pinned-tab.svg` is a solid-black mask SVG - Safari applies the color from the `mask-icon` link.
- If you update any assets, re-run `bump-sw-version` so the service worker sees a new cache name/version and clients get the update.
- The resume file should be named exactly `Estivan-Ayramia-Resume.pdf` and placed in `assets/docs/` so existing links work.

## 📂 Project Structure

```
/
├── index.html           # English home page
├── overview.html        # 1-minute overview
├── deep-dive.html       # 5-minute deep dive
├── about.html           # About page
├── projects.html        # Projects showcase
├── contact.html         # Contact form (Formspree)
├── privacy.html         # Privacy policy
├── 404.html             # Custom error page
├── manifest.json        # PWA manifest
├── sw.js                # Service worker (caching)
├── _headers             # Cloudflare security headers
├── _redirects           # Cloudflare/Netlify routing
├── DEPLOYMENT.md        # Deployment guide
├── ANALYTICS.md         # Analytics events reference
├── TESTING.md           # Local testing guide
├── /es/                 # Spanish versions
│   └── index.html
├── /ar/                 # Arabic versions (RTL)
│   └── index.html
└── /assets/
    ├── /css/
    │   └── theme.css    # Custom styles + animations
    ├── /js/
    │   └── site.js      # All interactions (1780 lines)
    └── /img/
        ├── icon-192.png # PWA icon small [CREATE THIS]
        └── icon-512.png # PWA icon large [CREATE THIS]
```

---

## 🛠️ Tech Stack

- **Framework**: Static HTML5
- **Styling**: Tailwind CSS (CDN)
- **Animations**: GSAP 3.12.2 + ScrollTrigger
- **Analytics**: Microsoft Clarity (ubbdpwxnae)
- **PWA**: Service Worker API, Cache API, Web App Manifest
- **Hosting**: Cloudflare Pages

- **Forms**: Formspree
- **Chatbot**: Chatbase
- **Hosting**: Cloudflare Pages

---

## ⚡ Quick Start

### 1. Clone & Setup
```powershell
cd C:\Users\Admin\OneDrive\portfolio-site
```

### 2. Test Locally
No build process required - just serve static files:

```powershell
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Using VS Code
# Install "Live Server" extension and click "Go Live"
```

Visit: `http://localhost:8000`

### 3. Create PWA Icons (Important!)
Before deploying, create these icons:
- `assets/img/icon-192.png` (192x192 pixels)
- `assets/img/icon-512.png` (512x512 pixels)

Use [Canva](https://canva.com) or [Favicon.io](https://favicon.io)

### 4. Deploy to Cloudflare
```powershell
git add .
git commit -m "Deploy portfolio with PWA support"
git push origin main
```

Cloudflare Pages auto-deploys from GitHub.

---

## 🚀 Deployment Checklist

### Before First Deploy

- [x] Replace all "TBD" metrics with real data
- [x] Update email in contact form (currently: `hello@estivanayramia.com`)
- [x] Test Formspree integration (`https://formspree.io/f/mblbnwoy`)
- [x] Verify Microsoft Clarity ID: `ubbdpwxnae`
- [x] Verify Chatbase ID: `fe5slOh95Jd3FwQHUxFDP`
- [ ] Add headshot image to `/assets/img/` (currently placeholder)
- [ ] **Create PWA icons**: icon-192.png and icon-512.png
- [ ] Test service worker locally (see TESTING.md)
- [ ] Run Lighthouse audit (target: 90+ all categories)
- [ ] Test on mobile device (iOS Safari, Android Chrome)

### After Deploy
- [ ] Verify PWA installable at https://www.estivanayramia.com
- [ ] Check service worker registered (DevTools → Application)
- [ ] Test offline mode works
- [ ] Confirm analytics events tracking (Clarity dashboard)
- [ ] Test all forms submit successfully
- [ ] Verify achievement system works
- [ ] Test Konami code: ↑↑↓↓←→←→BA

---

## 🎮 Interactive Features

### Achievement System
8 hidden achievements to boost user engagement:

| Achievement | Unlock Condition | ID |
|-------------|------------------|-----|
| 🗺️ Explorer | Visit all 7 main pages | `explorer` |
| 🤿 Deep Diver | Stay on Deep Dive page 30s | `deepdive` |
| 🏆 Game Master | Unlock all achievements | `gamemaster` |
| 💬 Conversationalist | Open chat widget | `chat` |
| 🌙 Night Owl | Toggle dark theme | `darkmode` |
| 🔍 Secret Discoverer | Activate Konami code | `konami` |
| 🤝 Networker | Click social media link | `social` |
| 📨 Messenger | Submit contact form | `contact` |

**Storage**: localStorage (`achievementsUnlocked`)

### Konami Code Easter Egg
Type: `↑ ↑ ↓ ↓ ← → ← → B A` (arrow keys, then B and A)
- Unlocks secret modal with personalized message
- Grants "Secret Discoverer" achievement
- Tracked in analytics

### Scroll-to-Top Button
- Appears bottom-left after scrolling 25% of page
- Smooth scroll animation
- Analytics tracking on click

### Form Enhancements
- Real-time inline validation
- Auto-prepends `https://` to URL fields
- Loading spinner on submit
- Error handling with clear messages

---

## 📊 Analytics & Monitoring

### Microsoft Clarity Integration
**Project ID**: `ubbdpwxnae`

**Tracked Events** (20+ events):
- Navigation clicks
- Button interactions
- Form submissions
- Social media clicks
- Scroll depth (25%, 50%, 75%, 100%)
- Theme toggle
- Achievement unlocks
- Easter egg activations

**Performance Metrics**:
- LCP (Largest Contentful Paint) - Target: < 2.5s
- FID (First Input Delay) - Target: < 100ms
- CLS (Cumulative Layout Shift) - Target: < 0.1

See `ANALYTICS.md` for complete event reference.

### View Analytics
1. Login: [Microsoft Clarity](https://clarity.microsoft.com/)
2. Select project: Estivan Ayramia Portfolio
3. View heatmaps, recordings, and event data

---

## 📱 PWA Features

### Service Worker
- **Cache Strategy**: Cache-first with network fallback
- **Cached Assets**: All HTML pages, CSS, JavaScript
- **Offline Support**: Shows cached pages or 404.html
- **Version**: `portfolio-v1` (increment for updates)

### Install as App
**Mobile** (Chrome/Safari):
1. Visit site
2. Tap "Add to Home Screen"
3. Icon appears on home screen
4. Opens as standalone app

**Desktop** (Chrome):
1. Click install icon in address bar
2. Confirm installation
3. Opens in app window (no browser UI)

### Offline Mode
Once installed:
- Browse all cached pages offline
- View content without internet
- Automatic sync when back online

See `TESTING.md` for local testing instructions.

---

## 🔒 Security

### Cloudflare Headers (`_headers`)
- **CSP**: Content Security Policy (blocks XSS)
- **X-Frame-Options**: DENY (prevents clickjacking)
- **X-Content-Type-Options**: nosniff
- **Referrer-Policy**: strict-origin-when-cross-origin

### Cache Policies
- Static assets (CSS/JS): 1 year
- Images: 1 month
- HTML: No cache (always fresh)
- Service worker: No cache (immediate updates)

---

## 📚 Documentation

- **DEPLOYMENT.md**: Complete deployment guide, troubleshooting
- **ANALYTICS.md**: All analytics events reference
- **TESTING.md**: Local testing instructions for PWA
- **CHANGELOG.md**: Version history and updates

---

## 🛠️ Customization

### Update Service Worker Cache
When you add/remove pages:

```javascript
// In sw.js, update urlsToCache array:
const urlsToCache = [
  '/',
  '/about.html',
  '/your-new-page.html',  // Add new pages here
  // ... rest of files
];

// Increment version:
const CACHE_NAME = 'portfolio-v2';  // v1 → v2
```

### Add New Analytics Event
```javascript
// In site.js:
if (typeof clarity === 'function') {
    clarity('event', 'your_event_name', { 
        optional_data: 'value' 
    });
}
```

### Add New Achievement
```javascript
// In site.js, add to achievements object:
const achievements = {
    // ... existing achievements
    newaward: {
        name: "Achievement Name",
        description: "How to unlock it",
        icon: "🎉"
    }
};

// Unlock with:
unlockAchievement('newaward');
```

---

## 🚀 Deploy to Cloudflare Pages

### Setup

1. Push code to GitHub
2. Go to Cloudflare Dashboard → Pages
3. Click "Create a project"
4. Connect your GitHub repository
5. Build settings:
   - **Build command**: (leave empty)
   - **Build output directory**: `/`
   - **Root directory**: `/`
6. Click "Save and Deploy"
7. Add custom domain: `estivanayramia.com`
8. Enable "Always Use HTTPS"

### Post-Launch

- [ ] Submit sitemap to Google Search Console
- [ ] Test analytics tracking (view in real-time)
- [ ] Monitor Clarity heatmaps after 24 hours
- [ ] Check chatbot responses
- [ ] Monitor Formspree submissions
- [ ] Set up email forwarding for `hello@estivanayramia.com`

---

## 🎨 Customization

### Colors (Tailwind Config)

colors: {
beige: '#e1d4c2', // Background
chocolate: '#362017', // Text primary
indigodeep: '#212842', // Accent
ink: '#0a0a0a' // Dark text
}

text

### Fonts

- **English/Spanish**: Inter (Google Fonts)
- **Arabic**: Cairo (Google Fonts, RTL-optimized)

### Adding New Pages

1. Copy an existing HTML file
2. Update content
3. Add navigation links in header/footer
4. Add to sitemap (create `sitemap.xml`)

---

## 📊 Analytics Setup

### Google Analytics 4
- **ID**: G-MCN4RXCY6Q
- Dashboard: https://analytics.google.com
- Track: pageviews, events, conversions

### Microsoft Clarity
- **ID**: uawk2g8xee
- Dashboard: https://clarity.microsoft.com
- Track: heatmaps, session recordings, rage clicks

### Chatbase
- **ID**: fe5slOh95Jd3FwQHUxFDP
- Dashboard: https://www.chatbase.co
- Train on site content, monitor questions

---

## 🔒 Privacy & Compliance

- Privacy policy: `/privacy.html`
- Data collection: analytics cookies only
- Form data: processed by Formspree (GDPR-compliant)
- No personal data stored locally

---

## 🐛 Troubleshooting

### GSAP animations not working
- Check browser console for errors
- Verify GSAP CDN links are loading
- Test with `prefers-reduced-motion` disabled

### Mobile menu not toggling
- Check `site.js` is loading
- Verify IDs match: `mobile-menu-toggle`, `mobile-menu`

### Form submissions failing
- Verify Formspree endpoint: `https://formspree.io/f/mblbnwoy`
- Check network tab for 200 response
- Test with valid email format

### Arabic text showing LTR
- Verify `<html lang="ar" dir="rtl">`
- Check `space-x-reverse` utility in Tailwind

---

## 📞 Support

- **Email**: hello@estivanayramia.com
- **Formspree Support**: https://help.formspree.io
- **Cloudflare Docs**: https://developers.cloudflare.com/pages/

---

## 📄 License

© 2025 Portfolio. All rights reserved.

---

## 🎯 Next Steps

1. Complete all Spanish and Arabic page translations
2. Add real project images
3. Record demo video for projects
4. Create blog section (optional)
5. Add testimonials section
6. Implement newsletter signup
7. Create PDF resume download
8. Add schema.org structured data for SEO

---

**Built with care. Deployed with confidence.**