# PWA Local Testing Guide

## 🧪 Testing PWA Features Locally

### Prerequisites
Service workers require HTTPS or localhost. Since you're testing locally, you can use:

1. **Python HTTP Server (recommended)**
2. **VS Code Live Server extension**
3. **Node.js http-server**

---

## Option 1: Python HTTP Server (Built-in)

### Steps:
```powershell
# Open PowerShell in portfolio-site folder
cd C:\Users\Admin\OneDrive\portfolio-site

# Start server (Python 3.x)
python -m http.server 8000

# Or Python 2.x
python -m SimpleHTTPServer 8000
```

**Access**: http://localhost:8000

### Test Checklist:
1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Check **Manifest**: Should show icon, name, theme color
4. Check **Service Workers**: Should show "activated and running"
5. Go to **Cache Storage**: Should see "portfolio-v1" with 12 files
6. Turn on "Offline" mode and reload page
7. Should still load (from cache)

---

## Option 2: VS Code Live Server

### Setup:
1. Install extension: `ritwickdey.LiveServer`
2. Right-click `index.html` → "Open with Live Server"
3. Automatically opens at http://127.0.0.1:5500

### Advantage:
- Auto-reload on file changes
- Better for development

---

## Option 3: Node.js http-server

### Install:
```powershell
npm install -g http-server
```

### Run:
```powershell
cd C:\Users\Admin\OneDrive\portfolio-site
http-server -p 8000 -c-1
```

`-c-1` disables caching for easier development

---

## 🔍 DevTools Inspection

### 1. Check Manifest (Application > Manifest)
Should show:
- ✅ Name: "Estivan Ayramia Portfolio"
- ✅ Short name: "EA Portfolio"
- ✅ Start URL: "/"
- ✅ Display: standalone
- ✅ Theme color: #212842
- ✅ Icons: 192x192 and 512x512 (currently broken until you add actual PNGs)

### 2. Check Service Worker (Application > Service Workers)
Should show:
- ✅ Status: activated and running
- ✅ Source: /sw.js
- ✅ Scope: /

**Actions**:
- Click "Update" to force refresh
- Click "Unregister" to clear and start fresh
- Check "Offline" to test offline mode

### 3. Check Cache Storage (Application > Cache Storage)
Should show cache: `portfolio-v1`
With files:
```
/ (index.html)
/about.html
/projects.html
/overview.html
/deep-dive.html
/contact.html
/privacy.html
/404.html
/assets/css/theme.css
/assets/js/site.js
```

### 4. Test Offline Mode
1. Load page once (while online)
2. Check "Offline" checkbox in Service Workers
3. Reload page (Ctrl+R)
4. Should load from cache
5. Navigate to other pages - should work
6. Try accessing non-cached page - should show 404.html

---

## 🐛 Common Issues

### Issue: Service Worker Not Registering
**Symptoms**: Console shows "Service Worker registration failed"

**Fixes**:
1. Check sw.js has no syntax errors
2. Verify file is at root directory
3. Clear browser cache (Ctrl+Shift+Delete)
4. Hard reload (Ctrl+Shift+R)
5. Check console for detailed error message

### Issue: Manifest Not Loading
**Symptoms**: DevTools shows "No manifest detected"

**Fixes**:
1. Verify `<link rel="manifest" href="/manifest.json">` in HTML
2. Check manifest.json has valid JSON
3. Ensure manifest.json is at root directory
4. Validate JSON: https://jsonlint.com/

### Issue: Icons Not Showing
**Symptoms**: Broken image icons in manifest

**Expected**: You haven't created the PNG files yet!

**Fix**:
1. Create icon-192.png (192x192 pixels)
2. Create icon-512.png (512x512 pixels)
3. Place in /assets/img/
4. Refresh manifest in DevTools

### Issue: Caching Not Working
**Symptoms**: Changes not appearing after edit

**Fixes**:
1. Increment CACHE_NAME in sw.js (e.g., 'portfolio-v2')
2. Unregister service worker in DevTools
3. Clear cache storage
4. Hard reload page

---

## 📱 Mobile Testing

### Test on Real Device:
1. Get your local IP address:
   ```powershell
   ipconfig | Select-String IPv4
   ```
2. Start server: `python -m http.server 8000`
3. On phone, visit: `http://YOUR_IP:8000`
4. Should see "Add to Home Screen" prompt
5. Install PWA and test offline

### Android Chrome:
- Menu → "Add to Home Screen"
- Opens as standalone app
- No browser UI

### iOS Safari:
- Share button → "Add to Home Screen"
- Icon appears on home screen
- Opens in fullscreen mode

---

## ✅ Full Test Checklist

### Before Deployment:
- [ ] Service worker registers successfully
- [ ] Manifest loads without errors
- [ ] All 12 pages are cached
- [ ] Offline mode works (shows cached pages or 404)
- [ ] Icons display correctly (after creating PNGs)
- [ ] Theme color shows in browser UI
- [ ] Analytics events fire (check Clarity)
- [ ] Form submission works
- [ ] All achievements unlock properly
- [ ] Konami code triggers modal
- [ ] Scroll button appears at 25%

### After Creating Icons:
- [ ] icon-192.png exists in /assets/img/
- [ ] icon-512.png exists in /assets/img/
- [ ] Icons are valid PNG format
- [ ] Icons show in manifest preview
- [ ] Install prompt shows on mobile

---

## 🚀 Deployment Test

### After deploying to Cloudflare:
1. Visit https://www.estivanayramia.com
2. Open DevTools
3. Run Lighthouse audit (Performance, PWA, SEO)
4. Target scores: All 90+
5. Check PWA checklist - should be all green

### Lighthouse PWA Requirements:
- ✅ Registers a service worker
- ✅ Responds with 200 when offline
- ✅ Contains metadata (manifest)
- ✅ Has valid icons
- ✅ Uses HTTPS
- ✅ Configures viewport
- ✅ Splash screen configured

---

## 🔄 Development Workflow

### Making Changes:
1. Edit files as needed
2. Increment CACHE_NAME in sw.js (if changed cached files)
3. Test locally
4. Commit and push to Cloudflare
5. Visit production site
6. Clear service worker (if needed)
7. Verify changes applied

### Quick Service Worker Reset:
```javascript
// Paste in browser console:
navigator.serviceWorker.getRegistrations().then(registrations => {
    for(let registration of registrations) {
        registration.unregister();
    }
    console.log('All service workers unregistered');
    location.reload(true);
});
```

---

**Testing Priority**: Focus on service worker functionality first, then manifest, then icons. Icons are cosmetic - PWA works without them, just won't look pretty when installed.

**Quick Test**: Visit http://localhost:8000 → Open DevTools → Check for service worker → Test offline mode → Done!
