# Portfolio Site - Quick Reference Card

## 🔥 Most Important Tasks

### 1. CREATE PWA ICONS (Critical!)
📍 Location: `/assets/img/`
📝 Files needed:
  - `icon-192.png` (192x192 pixels)
  - `icon-512.png` (512x512 pixels)
  
🎨 Design specs:
  - Your logo/brand on #212842 background
  - PNG format with transparency
  - 10-15px padding around edges
  - Tools: Canva, Photoshop, Favicon.io

### 2. Test PWA Locally
```powershell
python -m http.server 8000
# Visit http://localhost:8000
# Open DevTools → Application tab
# Check: Manifest ✓, Service Worker ✓, Cache ✓
```

### 3. Deploy to Cloudflare
```powershell
git add .
git commit -m "Add PWA icons and final polish"
git push origin main
```

---

## 🎯 Key URLs

| Resource | URL |
|----------|-----|
| **Live Site** | https://www.estivanayramia.com |
| **Clarity Dashboard** | https://clarity.microsoft.com/ (ID: ubbdpwxnae) |
| **Formspree** | https://formspree.io/f/mblbnwoy |
| **GitHub Repo** | [Your repo URL] |
| **Cloudflare Pages** | [Your dashboard] |

---

## 🎮 Easter Eggs to Test

1. **Konami Code**: `↑↑↓↓←→←→BA`
2. **Achievement System**: Visit all pages, toggle theme, submit form
3. **Scroll Button**: Scroll down 25% on any page
4. **Dark Mode**: Click theme toggle icon
5. **Offline Mode**: Install PWA, turn off wifi, browse site

---

## 📊 Analytics Events (Top 10)

| Event | What it tracks |
|-------|----------------|
| `navigation_click` | All nav menu clicks |
| `button_click_{label}` | CTA and submit buttons |
| `form_submission` | Contact form submitted |
| `scroll_50_percent` | User scrolled halfway |
| `theme_toggle` | Light/dark mode switch |
| `social_click` | LinkedIn/GitHub clicks |
| `scroll_to_top_clicked` | Scroll button used |
| `achievement_unlocked` | Any achievement earned |
| `konami_code_activated` | Easter egg found |
| Core Web Vitals | `lcp`, `fid`, `cls` metrics |

---

## 🛠️ Troubleshooting Commands

### Clear Service Worker
```javascript
// In browser console:
navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.unregister());
});
location.reload(true);
```

### Check PWA Status
```javascript
// In browser console:
navigator.serviceWorker.ready.then(reg => {
    console.log('Service Worker ready:', reg);
});
```

### View All Achievements
```javascript
// In browser console:
console.log(JSON.parse(localStorage.getItem('achievementsUnlocked')));
```

### Reset All Achievements
```javascript
// In browser console:
localStorage.removeItem('achievementsUnlocked');
localStorage.removeItem('pageVisits');
localStorage.removeItem('chatOpenTime');
location.reload();
```

---

## 📂 Critical Files

| File | Purpose | Edit When... |
|------|---------|--------------|
| `sw.js` | Service worker cache | Add/remove pages |
| `manifest.json` | PWA config | Change app name/colors |
| `_headers` | Security headers | Add new CDNs |
| `site.js` | All JavaScript | Add features |
| `theme.css` | Custom styles | Design changes |

---

## ✅ Pre-Deploy Checklist

Quick check before pushing to production:

```
□ PWA icons created (icon-192.png, icon-512.png)
□ Tested service worker locally
□ Verified all forms work
□ Checked mobile responsiveness
□ Tested offline mode
□ Achievement system working
□ Analytics events firing
□ No console errors
□ Lighthouse score 90+ (all categories)
□ Konami code tested
```

---

## 🚨 Emergency Fixes

### Site Not Loading
1. Check Cloudflare Pages deployment status
2. Verify DNS settings
3. Check _redirects file syntax

### Service Worker Issues
1. Increment CACHE_NAME in sw.js (v1→v2)
2. Redeploy to Cloudflare
3. Clear browser cache
4. Hard reload (Ctrl+Shift+R)

### Analytics Not Tracking
1. Check Clarity script loads (Network tab)
2. Wait 5-10 minutes for events to appear
3. Verify Clarity ID: `ubbdpwxnae`
4. Check browser console for errors

### Forms Not Submitting
1. Verify Formspree endpoint: `mblbnwoy`
2. Check browser console for errors
3. Test without validation (bypass JavaScript)
4. Check Formspree dashboard for quota

---

## 🎓 Learning Resources

- **PWA Docs**: https://web.dev/progressive-web-apps/
- **Service Workers**: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **Clarity Help**: https://docs.microsoft.com/en-us/clarity/
- **Cloudflare Pages**: https://developers.cloudflare.com/pages/

---

## 📞 Support

**Documentation:**
- Full guide: `DEPLOYMENT.md`
- Analytics reference: `ANALYTICS.md`
- Testing guide: `TESTING.md`
- Feature changelog: `CHANGELOG.md`

**Need Help?**
- Check browser console first
- Review documentation
- Test in incognito mode (clean cache)
- Check DevTools → Application tab

---

## 💡 Quick Tips

1. **Always test locally first** before deploying
2. **Increment service worker version** when changing cached files
3. **Check Clarity** within 10 minutes after making changes
4. **Use Lighthouse** in DevTools for performance audits
5. **Test on mobile devices** - PWA is mobile-first
6. **Monitor achievement unlock rate** to gauge engagement
7. **Keep console.log statements** for debugging (remove in production)

---

## 🔢 Version Info

- **Current Version**: v2.0.0
- **Service Worker Cache**: portfolio-v1
- **Last Updated**: January 2025
- **Total Lines (site.js)**: 1780
- **Achievement Count**: 8
- **Tracked Events**: 20+
- **Cached Pages**: 10

---

**Quick Start**: Create icons → Test locally → Deploy to Cloudflare → Verify PWA works → Monitor analytics

**Remember**: PWA icons are the only blocking issue. Everything else is functional!
