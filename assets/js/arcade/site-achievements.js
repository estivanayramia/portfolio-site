import { Achievements } from "./achievements.js";

const SESSION_PAGES_KEY = "ea.site.session.pages.v1";
const LAST_VISIT_KEY = "ea.site.lastVisitAt.v1";

function safePathname() {
  try {
    const url = new URL(window.location.href);
    return (url.pathname || "/").replace(/\/+$/, "") || "/";
  } catch {
    return (window.location && window.location.pathname) ? String(window.location.pathname) : "/";
  }
}

function loadSessionPages() {
  try {
    const raw = sessionStorage.getItem(SESSION_PAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

function saveSessionPages(pages) {
  try {
    sessionStorage.setItem(SESSION_PAGES_KEY, JSON.stringify(pages.slice(0, 50)));
  } catch {}
}

function isBetweenHours(hour, startInclusive, endInclusive) {
  return hour >= startInclusive && hour <= endInclusive;
}

function maybeUnlockTimeAchievements() {
  const now = new Date();
  const hour = now.getHours();

  if (isBetweenHours(hour, 0, 4)) {
    Achievements.unlock("site:night_owl", { hour });
  }
  if (isBetweenHours(hour, 5, 8)) {
    Achievements.unlock("site:early_bird", { hour });
  }
}

function maybeUnlockReturnVisitor() {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  try {
    const last = parseInt(localStorage.getItem(LAST_VISIT_KEY) || "0", 10);
    if (last && now - last >= dayMs) {
      Achievements.unlock("site:return_visitor", { hoursSince: Math.round((now - last) / 36e5) });
    }
    localStorage.setItem(LAST_VISIT_KEY, String(now));
  } catch {}
}

function maybeUnlockPathAchievements(path) {
  if (path === "/hobbies-games") {
    Achievements.unlock("site:arcade_visitor", { path });
  }
  if (path === "/contact") {
    Achievements.unlock("site:contact_visitor", { path });
  }
}

function maybeUnlockExplorer(path) {
  const pages = loadSessionPages();
  if (!pages.includes(path)) {
    pages.push(path);
    saveSessionPages(pages);
  }

  const uniqueCount = new Set(pages).size;
  if (uniqueCount >= 5) {
    Achievements.unlock("site:explorer", { uniquePagesThisSession: uniqueCount });
  }
}

export function initSiteAchievements() {
  // Keep this tiny and defensive: if anything fails, silently no-op.
  try {
    const path = safePathname();

    maybeUnlockTimeAchievements();
    maybeUnlockReturnVisitor();
    maybeUnlockPathAchievements(path);
    maybeUnlockExplorer(path);
  } catch {}
}
