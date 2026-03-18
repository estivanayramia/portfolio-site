import {
  cleanTextFragment,
  createPageRecord,
  isRelevantInternalRoute,
  normalizeRoute,
  tokenizeText
} from "./chat-grounding-utils.mjs";

export const CHAT_VERSION = "v2026.03.18-fresh-grounding";

const FACTS_KEY = "site-facts:v1";
const PROFILE_KEY = "profile:public:v1";
const PAGE_MANIFEST_KEY = "page-grounding:v1";
const DEFAULT_BASE_URL = "https://www.estivanayramia.com";
const IN_MEMORY_TTL_MS = 5 * 60 * 1000;
const LIVE_REFRESH_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CRAWL_PAGES = 48;
const MAX_RETRIEVED_PAGES = 4;
const MAX_RETRIEVED_SECTIONS = 6;

const GROUNDING_CACHE = globalThis.__savonieGroundingCache || (globalThis.__savonieGroundingCache = {
  profile: null,
  profileTimestamp: 0,
  facts: null,
  factsTimestamp: 0,
  manifest: null,
  manifestTimestamp: 0
});

const DEFAULT_START_ROUTES = [
  "/",
  "/overview",
  "/deep-dive",
  "/about",
  "/projects/",
  "/contact",
  "/hobbies/",
  "/es/",
  "/ar/"
];

const QUESTION_CLASSES = {
  GREETING: "greeting",
  ABOUT_GENERAL: "about_general",
  PROJECT_LIST: "project_list",
  PAGE_SPECIFIC: "page_specific",
  HIRE_CASE: "hire_case",
  SKEPTICAL_AI: "skeptical_ai",
  TEAM: "team",
  ROLE_FIT: "role_fit",
  WEAKNESS: "weakness",
  SURFACE_FACT: "surface_fact",
  LANGUAGES: "languages",
  CONTACT: "contact",
  RESUME: "resume",
  SITE_PROOF: "site_proof",
  BOUNDARY: "boundary",
  UNKNOWN: "unknown",
  OPEN: "open"
};

const BANNED_LANGUAGE = [
  "passionate about",
  "dynamic professional",
  "results-driven",
  "leveraging",
  "innovative thinker",
  "therapy-speak",
  "vibe hire",
  "family culture"
];

const SURFACE_FACT_PATTERNS = [
  { key: "favorite_color", pattern: /\b(favo[u]?rite|what color).*color|\bcolor\b/i },
  { key: "favorite_movie", pattern: /\b(favo[u]?rite|best).*movie|\bmovie\b/i },
  { key: "favorite_show", pattern: /\b(favo[u]?rite|best).*(show|shows|series)|\b(show|series)\b/i },
  { key: "favorite_book", pattern: /\b(favo[u]?rite|best).*book|\bbook\b/i },
  { key: "favorite_music", pattern: /\bmusic|artist|artists|band|bands|listen to\b/i },
  { key: "favorite_food", pattern: /\bfood|foods|eat|eating|meal|pizza|pasta|dessert\b/i },
  { key: "favorite_drink", pattern: /\bdrink|drinks|coffee|caffeine|coke zero|water\b/i },
  { key: "favorite_team", pattern: /\bbarcelona|fc barcelona|favorite team|sports team\b/i },
  { key: "favorite_sport", pattern: /\bsport|sports|soccer|football|volleyball|pickleball\b/i },
  { key: "languages", pattern: /\blanguages?|speak|write in|english|arabic|chaldean|spanish\b/i },
  { key: "hometown", pattern: /\bwhere.*from|hometown|grew up|el cajon|baghdad|born\b/i },
  { key: "birthday", pattern: /\bbirthday\b|\bborn on\b|\bwhen.*born\b|\bage\b/i },
  { key: "height", pattern: /\bheight|how tall|tall\b/i },
  { key: "style", pattern: /\bstyle|dress|clothes|fashion|shoes|cologne|jewelry\b/i }
];

function now() {
  return Date.now();
}

function withTrailingSlash(baseUrl) {
  return String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getCacheEntry(name) {
  const value = GROUNDING_CACHE[name];
  const timestamp = GROUNDING_CACHE[`${name}Timestamp`];
  if (!value || !timestamp || (now() - timestamp) > IN_MEMORY_TTL_MS) return null;
  return value;
}

function setCacheEntry(name, value) {
  GROUNDING_CACHE[name] = value;
  GROUNDING_CACHE[`${name}Timestamp`] = now();
  return value;
}

async function loadJsonFromKv(env, key) {
  if (!env?.SAVONIE_KV) return null;
  try {
    return await env.SAVONIE_KV.get(key, { type: "json" });
  } catch {
    return null;
  }
}

async function putJsonToKv(env, key, value, ttlSeconds = 7 * 24 * 60 * 60) {
  if (!env?.SAVONIE_KV || !value) return;
  try {
    await env.SAVONIE_KV.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch {
    // Best effort only.
  }
}

function getMinimalProfileFallback() {
  return {
    version: "fallback-public-profile",
    name: "Estivan Ayramia",
    perspective: "third_person",
    contact: {
      email: "hello@estivanayramia.com",
      site: DEFAULT_BASE_URL,
      linkedin: "https://www.linkedin.com/in/estivanayramia/"
    },
    identity: {
      hometown: "El Cajon, California",
      education: {
        school: "San Diego State University",
        degree: "General Business"
      }
    },
    voice: {
      default: "warm, sharp, grounded, low-ego",
      neverSay: BANNED_LANGUAGE
    },
    answerSeeds: {
      aboutGeneral: [
        "Estivan cares about people, process, and doing the work right.",
        "This site exists because a resume leaves too much out."
      ],
      outreach: [
        "If you want the fuller version, reaching out directly is the best move."
      ]
    }
  };
}

function getMinimalFactsFallback() {
  return {
    version: "fallback-facts",
    projects: [],
    hobbies: [],
    meta: {
      projectCount: 0,
      hobbyCount: 0,
      source: "Minimal fallback"
    }
  };
}

function parsePageContext(rawPageContext, legacyPageContent) {
  if (rawPageContext && typeof rawPageContext === "object") {
    return {
      route: normalizeRoute(rawPageContext.route || rawPageContext.path || "/"),
      title: cleanTextFragment(rawPageContext.title || ""),
      buildVersion: cleanTextFragment(rawPageContext.buildVersion || ""),
      description: cleanTextFragment(rawPageContext.description || ""),
      headings: Array.isArray(rawPageContext.headings)
        ? rawPageContext.headings.map((value) => cleanTextFragment(value)).filter(Boolean)
        : [],
      text: cleanTextFragment(rawPageContext.text || rawPageContext.pageContent || "")
    };
  }

  const lines = String(legacyPageContent || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const routeLine = lines.find((line) => line.toLowerCase().startsWith("path:"));
  const titleLine = lines.find((line) => line.toLowerCase().startsWith("title:"));
  const headings = lines
    .filter((line) => line.startsWith("- "))
    .map((line) => cleanTextFragment(line.slice(2)))
    .filter(Boolean);

  return {
    route: normalizeRoute(routeLine ? routeLine.slice(5).trim() : "/"),
    title: cleanTextFragment(titleLine ? titleLine.slice(6).trim() : ""),
    buildVersion: "",
    description: "",
    headings,
    text: cleanTextFragment(legacyPageContent || "")
  };
}

function inferBaseUrl(request, env) {
  if (env?.SITE_BASE_URL) return withTrailingSlash(env.SITE_BASE_URL);

  try {
    const url = new URL(request.url);
    if (/estivanayramia\.com$/i.test(url.hostname)) {
      return withTrailingSlash(`${url.protocol}//${url.host}`);
    }
  } catch {
    // Ignore malformed request URLs.
  }

  const origin = request.headers.get("Origin");
  if (origin && /^https?:\/\//i.test(origin)) return withTrailingSlash(origin);

  return DEFAULT_BASE_URL;
}

function normalizeManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.pages)) return null;
  const pages = manifest.pages
    .map((page) => ({
      ...page,
      route: normalizeRoute(page.route),
      canonical: normalizeRoute(page.canonical || page.route),
      headings: Array.isArray(page.headings) ? page.headings.filter(Boolean) : [],
      keywords: Array.isArray(page.keywords) ? page.keywords.filter(Boolean) : [],
      links: Array.isArray(page.links) ? page.links.map((link) => normalizeRoute(link)).filter(Boolean) : [],
      sections: Array.isArray(page.sections) ? page.sections.map((section) => ({
        heading: cleanTextFragment(section.heading || ""),
        level: Number(section.level || 2),
        text: cleanTextFragment(section.text || ""),
        keywords: Array.isArray(section.keywords)
          ? section.keywords.filter(Boolean)
          : tokenizeText(`${section.heading || ""} ${section.text || ""}`).slice(0, 24)
      })).filter((section) => section.heading || section.text) : []
    }))
    .filter((page) => page.route);

  return {
    ...manifest,
    pages
  };
}

async function loadProfile(env) {
  const cached = getCacheEntry("profile");
  if (cached) return cached;

  const kvProfile = env?.__CHAT_PROFILE || await loadJsonFromKv(env, PROFILE_KEY);
  return setCacheEntry("profile", kvProfile || getMinimalProfileFallback());
}

async function loadSiteFacts(env) {
  const cached = getCacheEntry("facts");
  if (cached) return cached;

  const kvFacts = env?.__SITE_FACTS || await loadJsonFromKv(env, FACTS_KEY);
  return setCacheEntry("facts", kvFacts || getMinimalFactsFallback());
}

async function loadPageManifest(env) {
  const cached = getCacheEntry("manifest");
  if (cached) return cached;

  const kvManifest = env?.__PAGE_MANIFEST || await loadJsonFromKv(env, PAGE_MANIFEST_KEY);
  return setCacheEntry("manifest", normalizeManifest(kvManifest));
}

function chooseManifestBuildVersion(pages) {
  const counts = new Map();
  for (const page of pages) {
    if (!page.buildVersion) continue;
    counts.set(page.buildVersion, (counts.get(page.buildVersion) || 0) + 1);
  }

  let bestVersion = "";
  let bestCount = 0;
  for (const [version, count] of counts.entries()) {
    if (count > bestCount) {
      bestVersion = version;
      bestCount = count;
    }
  }
  return bestVersion;
}

function shouldRefreshManifest(manifest, requestedBuildVersion) {
  if (!manifest || !Array.isArray(manifest.pages) || !manifest.pages.length) return true;
  if (requestedBuildVersion && manifest.buildVersion && requestedBuildVersion !== manifest.buildVersion) return true;

  const refreshedAt = manifest.refreshedAt ? Date.parse(manifest.refreshedAt) : 0;
  if (refreshedAt && (now() - refreshedAt) > LIVE_REFRESH_TTL_MS) return true;

  return false;
}

async function buildLivePageManifest({ baseUrl, fetchImpl }) {
  const visited = new Set();
  const queue = [...DEFAULT_START_ROUTES];
  const pages = [];

  while (queue.length && visited.size < MAX_CRAWL_PAGES) {
    const route = normalizeRoute(queue.shift());
    if (!route || visited.has(route) || !isRelevantInternalRoute(route)) continue;
    visited.add(route);

    let response;
    try {
      response = await fetchImpl(`${baseUrl}${route}`, {
        headers: {
          Accept: "text/html,application/xhtml+xml"
        }
      });
    } catch {
      continue;
    }

    if (!response?.ok) continue;
    const contentType = response.headers?.get?.("content-type") || "";
    if (contentType && !contentType.includes("text/html")) continue;

    const html = await response.text();
    const page = createPageRecord({
      route,
      html,
      sourceFile: `live:${route}`
    });
    pages.push(page);

    for (const link of page.links) {
      if (!visited.has(link) && isRelevantInternalRoute(link)) {
        queue.push(link);
      }
    }
  }

  pages.sort((left, right) => left.route.localeCompare(right.route));

  return {
    version: "page-grounding-v1",
    source: "runtime-live-crawl",
    baseUrl,
    buildVersion: chooseManifestBuildVersion(pages),
    refreshedAt: new Date().toISOString(),
    pageCount: pages.length,
    pages
  };
}

async function refreshManifestIfNeeded(env, request, requestedBuildVersion, manifest) {
  if (!shouldRefreshManifest(manifest, requestedBuildVersion)) {
    return {
      manifest,
      source: "cache_or_kv",
      refreshed: false
    };
  }

  const baseUrl = inferBaseUrl(request, env);

  try {
    const liveManifest = await buildLivePageManifest({
      baseUrl,
      fetchImpl: fetch
    });
    await putJsonToKv(env, PAGE_MANIFEST_KEY, liveManifest);
    setCacheEntry("manifest", liveManifest);
    return {
      manifest: liveManifest,
      source: "runtime_live_refresh",
      refreshed: true
    };
  } catch {
    return {
      manifest,
      source: manifest ? "stale_manifest" : "missing_manifest",
      refreshed: false
    };
  }
}

function detectRegister(message) {
  const lower = String(message || "").toLowerCase();

  if (/(actually|be honest|seriously|mostly ai|just ai|real skill|why should|convince me)/i.test(lower)) {
    return "skeptical";
  }

  if (/(yo|lol|lmao|bro|dude|hey man|wassup|what's up)/i.test(lower)) {
    return "casual";
  }

  if (/(please|could you|would you|hiring manager|recruiter|experience|qualifications|evaluate)/i.test(lower)) {
    return "formal";
  }

  if (/(curious|wondering|tell me more|interested)/i.test(lower)) {
    return "curious";
  }

  return "default";
}

function classifyQuestion(message) {
  const lower = String(message || "").toLowerCase().trim();

  if (!lower) return QUESTION_CLASSES.UNKNOWN;
  if (/^(hi|hello|hey|yo|what's up|whats up|good morning|good afternoon|good evening)\b/.test(lower)) {
    return QUESTION_CLASSES.GREETING;
  }
  if (/\b(contact|email|reach out|reach him|reach you|linkedin)\b/.test(lower)) {
    return QUESTION_CLASSES.CONTACT;
  }
  if (/\b(resume|cv|download)\b/.test(lower)) {
    return QUESTION_CLASSES.RESUME;
  }
  if (/\b(why hire|more experience|hire you|hire him|worth interviewing)\b/.test(lower)) {
    return QUESTION_CLASSES.HIRE_CASE;
  }
  if (/\b(mostly ai|just ai|is this ai|real skill|actually skilled)\b/.test(lower)) {
    return QUESTION_CLASSES.SKEPTICAL_AI;
  }
  if (SURFACE_FACT_PATTERNS.some((entry) => entry.pattern.test(lower))) {
    return QUESTION_CLASSES.SURFACE_FACT;
  }
  if (/\b(on a team|like on a team|work with|working with|team setting|team member)\b/.test(lower)) {
    return QUESTION_CLASSES.TEAM;
  }
  if (/\b(role|roles|fit him best|fit you best|best fit|where do you fit)\b/.test(lower)) {
    return QUESTION_CLASSES.ROLE_FIT;
  }
  if (/\b(weakness|weaknesses|gap|gaps|what are you bad at|where do you need work)\b/.test(lower)) {
    return QUESTION_CLASSES.WEAKNESS;
  }
  if (/\b(what does this site prove|what does the site prove|what does the website prove)\b/.test(lower)) {
    return QUESTION_CLASSES.SITE_PROOF;
  }
  if (/\b(projects|work samples|what have you done|what projects)\b/.test(lower)) {
    return QUESTION_CLASSES.PROJECT_LIST;
  }
  if (/\b(languages|speak|write in|english|arabic|chaldean|spanish)\b/.test(lower)) {
    return QUESTION_CLASSES.LANGUAGES;
  }
  if (/\b(sat|act|gpa|gmat|lsat|class rank|iq)\b/.test(lower)) {
    return QUESTION_CLASSES.UNKNOWN;
  }
  if (/\b(relationship|dating|girlfriend|boyfriend|ex|family drama|mental health|diagnosed|address|where exactly do you live|salary you make)\b/.test(lower)) {
    return QUESTION_CLASSES.BOUNDARY;
  }
  if (/\b(what's he about|whats he about|what are you about|who are you|tell me about yourself|tell me about estivan)\b/.test(lower)) {
    return QUESTION_CLASSES.ABOUT_GENERAL;
  }
  if (/\b(page|site|homepage|overview|deep dive|about|project page|hobbies|whispers|portfolio build|loreal|endpoint|franklin|cooking|reading|photography|me page)\b/.test(lower)) {
    return QUESTION_CLASSES.PAGE_SPECIFIC;
  }
  return QUESTION_CLASSES.OPEN;
}

function detectSurfaceFactKey(message) {
  const lower = String(message || "").toLowerCase();
  const match = SURFACE_FACT_PATTERNS.find((entry) => entry.pattern.test(lower));
  return match ? match.key : "";
}

function scorePage(page, queryTokens, message, questionClass) {
  const lower = String(message || "").toLowerCase();
  let score = 0;
  const route = String(page.route || "");
  const title = String(page.title || "").toLowerCase();
  const summary = String(page.summary || "").toLowerCase();
  const description = String(page.description || "").toLowerCase();
  const headings = (page.headings || []).join(" ").toLowerCase();

  if (lower.includes(route.replace(/\/$/, "")) && route !== "/") score += 30;
  if (title && lower.includes(title)) score += 24;

  for (const token of queryTokens) {
    if (route.includes(token)) score += 7;
    if (title.includes(token)) score += 9;
    if (headings.includes(token)) score += 6;
    if (summary.includes(token)) score += 5;
    if (description.includes(token)) score += 4;
    if ((page.keywords || []).includes(token)) score += 3;
  }

  if (questionClass === QUESTION_CLASSES.PAGE_SPECIFIC) {
    if (page.pageType === "project_detail" || page.pageType === "hobby_detail" || page.pageType === "about_detail") {
      score += 10;
    }
  }

  if (questionClass === QUESTION_CLASSES.PROJECT_LIST && page.pageType === "projects_index") score += 12;
  if (questionClass === QUESTION_CLASSES.TEAM && (route === "/overview" || route === "/deep-dive" || route === "/about")) score += 8;
  if (questionClass === QUESTION_CLASSES.LANGUAGES && (route === "/overview" || route === "/about" || route === "/deep-dive" || route === "/es/" || route === "/ar/")) score += 8;
  if (questionClass === QUESTION_CLASSES.SITE_PROOF && (route === "/" || route === "/projects/portfolio")) score += 12;

  return score;
}

function scoreSection(page, section, queryTokens, message) {
  const lower = String(message || "").toLowerCase();
  let score = 0;
  const heading = String(section.heading || "").toLowerCase();
  const text = String(section.text || "").toLowerCase();

  if (heading && lower.includes(heading)) score += 10;
  for (const token of queryTokens) {
    if (heading.includes(token)) score += 7;
    if (text.includes(token)) score += 3;
  }

  if (page.pageType === "project_detail" && /overview|what i did|result|numbers|why this way/i.test(heading)) {
    score += 1;
  }

  return score;
}

function retrieveGrounding(message, manifest, questionClass, currentRoute) {
  const queryTokens = tokenizeText(message);
  const pages = Array.isArray(manifest?.pages) ? manifest.pages : [];

  const scoredPages = pages
    .map((page) => ({
      page,
      score: scorePage(page, queryTokens, message, questionClass)
    }))
    .filter((entry) => entry.score > 0 || entry.page.route === currentRoute)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_RETRIEVED_PAGES);

  const sections = [];
  for (const entry of scoredPages) {
    const pageSections = (entry.page.sections || [])
      .map((section) => ({
        page: entry.page,
        section,
        score: scoreSection(entry.page, section, queryTokens, message)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 2);

    sections.push(...pageSections);
  }

  sections.sort((left, right) => right.score - left.score);

  return {
    queryTokens,
    pages: scoredPages.map((entry) => entry.page),
    sections: sections.slice(0, MAX_RETRIEVED_SECTIONS)
  };
}

function formatInternalLink(label, route) {
  if (!route) return label;
  return `[${label}](${route})`;
}

function getDisplayPageTitle(page) {
  const rawTitle = String(page?.title || "").trim();
  if (!rawTitle) return String(page?.route || "").trim() || "that page";
  return rawTitle.replace(/\s*\|\s*Estivan Ayramia\s*$/i, "").trim();
}

function formatProjectList(siteFacts) {
  const projects = Array.isArray(siteFacts?.projects) ? siteFacts.projects : [];
  const topProjects = projects.slice(0, 5);
  if (!topProjects.length) {
    return "The quickest place to see the work is [Projects](/projects/).";
  }

  const list = topProjects
    .map((project) => formatInternalLink(project.title, project.url))
    .join(", ");
  return `Right now the site shows ${list}.`;
}

function formatSurfaceFactReply(key, profile) {
  const preferences = profile.preferences || {};
  const identity = profile.identity || {};

  switch (key) {
    case "favorite_color":
      return "Brown, beige, and cream. He likes earthy colors. They feel grounded without trying too hard.";
    case "favorite_movie":
      return "Iron Man. Part of why it sticks is the Tony Stark 'built this in a cave' energy.";
    case "favorite_show":
      return "White Collar, Burn Notice, Prison Break, and Psych are the main ones. Psych stands out because of how closely it notices details.";
    case "favorite_book":
      return "How to Win Friends and Influence People. The useful part for him is the genuine-interest side of it, not the cheesy version.";
    case "favorite_music":
      return "His music taste is broad, but Drake, Arctic Monkeys, The Marias, and The Neighbourhood are easy standouts.";
    case "favorite_food":
      return "Pizza and pasta are the safest answers. He leans savory, and the dessert pick is Ben & Jerry's strawberry cheesecake.";
    case "favorite_drink":
      return "Water and Coke Zero are the regular go-tos. Caffeine usually makes him sleepy, which is not the most efficient setup.";
    case "favorite_sport":
      return "Soccer is the favorite. He also plays volleyball and pickleball for fun, but soccer wins.";
    case "favorite_team":
      return "FC Barcelona.";
    case "languages":
      return "Estivan speaks Arabic, Chaldean, English, and Spanish. He writes in English, Arabic, and Spanish, but not Chaldean.";
    case "hometown":
      return `He was born in ${identity.birthplace || "Baghdad, Iraq"} and grew up in ${identity.hometown || "El Cajon"}.`;
    case "birthday":
      return "January 21, 2004.";
    case "height":
      return identity.height || "5'10\" barefoot.";
    case "style":
      return `${preferences.style?.summary || "His style depends on the outing."} Favorite shoes are ${preferences.style?.shoes?.join(", ") || "Nike Dunks, Jordan 1s, and Air Forces"}, and yes, he cares about cologne more than most people probably should.`;
    default:
      return "";
  }
}

function buildBoundaryReply() {
  return "Some things stay off the public version on purpose. The site can still help with the work, the site, how he thinks, or anything already on the portfolio.";
}

function buildUnknownReply(profile) {
  return `That is better answered by Estivan directly. The cleanest move is [Contact](/contact) or email ${profile.contact?.email || "hello@estivanayramia.com"}.`;
}

function buildPageSpecificReply(retrieval) {
  const [topPage] = retrieval.pages;
  if (!topPage) {
    return "";
  }

  const displayTitle = getDisplayPageTitle(topPage);

  const sectionLines = retrieval.sections
    .filter((entry) => entry.page.route === topPage.route)
    .slice(0, 2)
    .map((entry) => {
      if (!entry.section.text) return "";
      const sectionHeading = cleanTextFragment(entry.section.heading || "")
        .replace(/\s*\|\s*Estivan Ayramia\s*$/i, "")
        .trim();
      const rawSnippet = cleanTextFragment(entry.section.text || "");
      const dedupedSnippet = sectionHeading && rawSnippet.toLowerCase().startsWith(sectionHeading.toLowerCase())
        ? rawSnippet.slice(sectionHeading.length).trim().replace(/^[:.\-–—]\s*/, "")
        : rawSnippet;
      const snippet = dedupedSnippet.length > 180
        ? `${dedupedSnippet.slice(0, 177).trimEnd()}...`
        : dedupedSnippet;
      if (!sectionHeading || sectionHeading.toLowerCase() === displayTitle.toLowerCase()) {
        return snippet;
      }
      return `${sectionHeading}: ${snippet}`;
    })
    .filter(Boolean);

  const intro = topPage.summary
    ? `${formatInternalLink(displayTitle, topPage.route)} is the best place for that. ${topPage.summary}`
    : `${formatInternalLink(displayTitle, topPage.route)} is the best page for that question.`;

  if (!sectionLines.length) return intro;

  return `${intro} The clearest parts are ${sectionLines.join(" ")}`.trim();
}

function buildDeterministicReply({ questionClass, surfaceFactKey, profile, siteFacts, retrieval }) {
  const seeds = profile.answerSeeds || {};

  switch (questionClass) {
    case QUESTION_CLASSES.GREETING:
      return "Hey. Savonie can help with questions about Estivan, the work, or the site. What do you actually want to know?";
    case QUESTION_CLASSES.CONTACT:
      return `Best options are [Contact](/contact), ${profile.contact?.email || "hello@estivanayramia.com"}, or LinkedIn if that fits better.`;
    case QUESTION_CLASSES.RESUME:
      return "The [resume PDF](/assets/docs/Estivan-Ayramia-Resume.pdf) is the quickest source for that.";
    case QUESTION_CLASSES.HIRE_CASE:
      return `${(seeds.hireOverExperience || []).join(" ")} ${formatProjectList(siteFacts)}`;
    case QUESTION_CLASSES.SKEPTICAL_AI:
      return `${(seeds.aiSkeptical || []).join(" ")} ${formatInternalLink("The portfolio build page", "/projects/portfolio")} is the cleanest proof.`;
    case QUESTION_CLASSES.TEAM:
      return (seeds.team || []).join(" ");
    case QUESTION_CLASSES.ROLE_FIT:
      return (seeds.roles || []).join(" ");
    case QUESTION_CLASSES.WEAKNESS:
      return (seeds.weakness || []).join(" ");
    case QUESTION_CLASSES.LANGUAGES:
      return formatSurfaceFactReply("languages", profile);
    case QUESTION_CLASSES.SURFACE_FACT:
      return formatSurfaceFactReply(surfaceFactKey, profile);
    case QUESTION_CLASSES.SITE_PROOF:
      return `${(seeds.siteProof || []).join(" ")} ${formatInternalLink("The site build page", "/projects/portfolio")} goes deeper.`;
    case QUESTION_CLASSES.PROJECT_LIST:
      return formatProjectList(siteFacts);
    case QUESTION_CLASSES.PAGE_SPECIFIC:
      return buildPageSpecificReply(retrieval);
    case QUESTION_CLASSES.BOUNDARY:
      return buildBoundaryReply();
    case QUESTION_CLASSES.ABOUT_GENERAL:
      return `${(seeds.aboutGeneral || []).join(" ")} ${(seeds.outreach || []).slice(1, 2).join(" ")}`.trim();
    case QUESTION_CLASSES.UNKNOWN:
      return buildUnknownReply(profile);
    default:
      return "";
  }
}

function shouldUseDeterministicOnly(questionClass, retrieval) {
  if (
    questionClass === QUESTION_CLASSES.GREETING ||
    questionClass === QUESTION_CLASSES.CONTACT ||
    questionClass === QUESTION_CLASSES.RESUME ||
    questionClass === QUESTION_CLASSES.HIRE_CASE ||
    questionClass === QUESTION_CLASSES.SKEPTICAL_AI ||
    questionClass === QUESTION_CLASSES.TEAM ||
    questionClass === QUESTION_CLASSES.ROLE_FIT ||
    questionClass === QUESTION_CLASSES.WEAKNESS ||
    questionClass === QUESTION_CLASSES.SURFACE_FACT ||
    questionClass === QUESTION_CLASSES.LANGUAGES ||
    questionClass === QUESTION_CLASSES.SITE_PROOF ||
    questionClass === QUESTION_CLASSES.PROJECT_LIST ||
    questionClass === QUESTION_CLASSES.BOUNDARY ||
    questionClass === QUESTION_CLASSES.ABOUT_GENERAL ||
    questionClass === QUESTION_CLASSES.UNKNOWN
  ) {
    return true;
  }

  if (questionClass === QUESTION_CLASSES.PAGE_SPECIFIC && retrieval.pages.length > 0) {
    return true;
  }

  return false;
}

function buildRegisterInstruction(register) {
  if (register === "formal") {
    return "Use a calm, direct, professional register. No extra jokes.";
  }
  if (register === "casual") {
    return "Use a more relaxed register with light personality, but stay credible.";
  }
  if (register === "skeptical") {
    return "Use a calm, sharp, non-defensive register.";
  }
  if (register === "curious") {
    return "Use a warm, slightly more open register without overexplaining.";
  }
  return "Use a clean, warm, sharp default register.";
}

export function buildModelContext({
  message,
  language,
  pageContext,
  profile,
  siteFacts,
  retrieval,
  questionClass,
  register,
  manifestStatus
}) {
  const retrievedPages = retrieval.pages
    .map((page) => {
      const sections = retrieval.sections
        .filter((entry) => entry.page.route === page.route)
        .slice(0, 2)
        .map((entry) => `- ${entry.section.heading}: ${entry.section.text}`)
        .join("\n");

      return [
        `PAGE ${page.route}`,
        `Title: ${page.title}`,
        `Summary: ${page.summary}`,
        sections ? `Sections:\n${sections}` : ""
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");

  const projectList = Array.isArray(siteFacts?.projects)
    ? siteFacts.projects.map((project) => `- ${project.title} (${project.url})`).join("\n")
    : "";

  const hobbyList = Array.isArray(siteFacts?.hobbies)
    ? siteFacts.hobbies.map((hobby) => `- ${hobby.title} (${hobby.url})`).join("\n")
    : "";

  // Behavioral design is deliberate here: adaptive register, active attention, and
  // layered disclosure are applied as output rules so the bot stays socially smart
  // instead of defaulting to generic assistant niceness.
  return `
SYSTEM: You are Savonie, the on-site chat voice for Estivan Ayramia.
PERSPECTIVE: Speak about Estivan in THIRD PERSON by default.
LANGUAGE: Reply in ${language || "English"}.
REGISTER: ${buildRegisterInstruction(register)}
QUESTION CLASS: ${questionClass}
GROUNDING STATUS: ${manifestStatus}

SOURCE-OF-TRUTH ORDER:
1. Retrieved current site pages
2. Approved public profile
3. Verified generated site facts
4. Minimal inference only when clearly marked

NON-NEGOTIABLE RULES:
- Do not guess.
- Do not invent facts, metrics, page details, opinions, or preferences.
- If something is not confirmed, say so clearly and suggest direct outreach.
- Protect credibility. Let proof do the work.
- Keep answers grounded, useful, and human.
- No corporate jargon, therapy-speak, fake-deep language, or resume perfume.
- Avoid every entry in the approved never-say blacklist from the public profile.
- Keep some mystery. Do not overexpose private details.
- Never use first person for Estivan. Refer to him as Estivan, he, or his unless the user explicitly asks for a direct quote.

PUBLIC PROFILE:
- Name: ${profile.name}
- Hometown: ${profile.identity?.hometown || "El Cajon, California"}
- Background: ${(profile.identity?.background || []).join(", ")}
- Education: ${profile.identity?.education?.school || "SDSU"} / ${profile.identity?.education?.degree || "General Business"}
- Languages spoken: ${(profile.identity?.languages?.spoken || []).join(", ")}
- Contact email: ${profile.contact?.email || "hello@estivanayramia.com"}
- Core drive: ${profile.goals?.drive || ""}
- Team view: ${profile.behavior?.teamFit || ""}
- AI view: ${profile.behavior?.aiView || ""}

RETRIEVED CURRENT PAGES:
${retrievedPages || "No current page retrieval available."}

VERIFIED SITE FACTS:
Projects:
${projectList || "- No verified project list available."}

Hobbies:
${hobbyList || "- No verified hobby list available."}

CURRENT PAGE CONTEXT:
- Route: ${pageContext.route || "/"}
- Title: ${pageContext.title || "Unknown"}
- Build version: ${pageContext.buildVersion || "Unknown"}
- Headings: ${(pageContext.headings || []).join(" | ") || "None provided"}

OUTPUT SHAPE:
- Default to 2-5 sentences.
- For recruiter or skeptical questions, answer directly and let proof carry the weight.
- For light personal questions, answer briefly with one line of flavor.
- For page-specific questions, anchor the answer in the retrieved page and link to it naturally.
- If the question is shallow, you can gently invite a better one, but do not sound annoyed.
- Use markdown links for internal routes when useful.

USER QUESTION:
${message}
`.trim();
}

function soundsTooFirstPerson(reply) {
  const lower = String(reply || "").toLowerCase();
  const firstPersonCount = (lower.match(/\b(i|i['’]m|i['’]ve|i['’]d|my|me|mine)\b/g) || []).length;
  const thirdPersonCount = (lower.match(/\b(estivan|he|his|him)\b/g) || []).length;
  return firstPersonCount > thirdPersonCount;
}

export function hasBannedLanguage(reply) {
  const lower = String(reply || "").toLowerCase();
  return BANNED_LANGUAGE.some((phrase) => lower.includes(phrase));
}

function stripUnsafeArtifacts(reply) {
  return String(reply || "")
    .replace(/^```(?:json|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/\n?\s*\{[\s\S]*"reply"[\s\S]*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function postProcessReply(reply, fallbackReply) {
  const cleaned = stripUnsafeArtifacts(reply);
  if (!cleaned) return fallbackReply;
  if (hasBannedLanguage(cleaned)) return fallbackReply;
  if (soundsTooFirstPerson(cleaned)) return fallbackReply;
  return cleaned;
}

export function buildChips(questionClass, retrieval) {
  if (questionClass === QUESTION_CLASSES.HIRE_CASE) {
    return ["What roles fit him best?", "What is he like on a team?", "Show me the portfolio build"];
  }
  if (questionClass === QUESTION_CLASSES.SKEPTICAL_AI) {
    return ["How did he build the site?", "What does the site prove?", "Show me a project"];
  }
  if (questionClass === QUESTION_CLASSES.TEAM) {
    return ["What roles fit him best?", "What are his weaknesses?", "Show me the overview"];
  }
  if (questionClass === QUESTION_CLASSES.PROJECT_LIST) {
    return ["Show me the portfolio build", "Tell me about Endpoint", "How can I contact him?"];
  }
  if (questionClass === QUESTION_CLASSES.PAGE_SPECIFIC && retrieval.pages[0]) {
    return [
      `Tell me more about ${retrieval.pages[0].title}`,
      "What projects has he done?",
      "How can I contact him?"
    ];
  }
  if (questionClass === QUESTION_CLASSES.SURFACE_FACT) {
    return ["What is he like on a team?", "What projects has he done?", "How did he build the site?"];
  }
  return ["Projects", "Resume", "Contact"];
}

export async function prepareChatContext({ env, request, message, language, rawPageContext, legacyPageContent }) {
  const pageContext = parsePageContext(rawPageContext, legacyPageContent);
  const requestedBuildVersion = pageContext.buildVersion;
  const [profile, siteFacts, manifestFromKv] = await Promise.all([
    loadProfile(env),
    loadSiteFacts(env),
    loadPageManifest(env)
  ]);

  const manifestRefresh = await refreshManifestIfNeeded(env, request, requestedBuildVersion, manifestFromKv);
  const manifest = manifestRefresh.manifest || {
    version: "page-grounding-v1",
    source: "missing",
    buildVersion: "",
    pages: []
  };

  const questionClass = classifyQuestion(message);
  const register = detectRegister(message);
  const retrieval = retrieveGrounding(message, manifest, questionClass, pageContext.route);
  const surfaceFactKey = questionClass === QUESTION_CLASSES.SURFACE_FACT ? detectSurfaceFactKey(message) : "";
  const fallbackReply = buildDeterministicReply({
    questionClass,
    surfaceFactKey,
    profile,
    siteFacts,
    retrieval
  }) || buildUnknownReply(profile);

  return {
    profile,
    siteFacts,
    manifest,
    manifestStatus: manifestRefresh.source,
    pageContext,
    questionClass,
    register,
    retrieval,
    surfaceFactKey,
    fallbackReply,
    deterministicOnly: shouldUseDeterministicOnly(questionClass, retrieval)
  };
}
