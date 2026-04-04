import {
  cleanTextFragment,
  createPageRecord,
  isRelevantInternalRoute,
  normalizeRoute,
  tokenizeText
} from "./chat-grounding-utils.mjs";

export const CHAT_VERSION = "v2026.03.30-savonie-v2";

const FACTS_KEY = "site-facts:v1";
const PROFILE_KEY = "profile:public:v1";
const PAGE_MANIFEST_KEY = "page-grounding:v1";
const DEFAULT_BASE_URL = "https://www.estivanayramia.com";
const IN_MEMORY_TTL_MS = 5 * 60 * 1000;
const LIVE_REFRESH_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CRAWL_PAGES = 48;
const MAX_RETRIEVED_PAGES = 8;
const MAX_RETRIEVED_SECTIONS = 12;

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
  COMPLEX_OPEN: "complex_open",
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

const PERSONAL_KNOWLEDGE = {
  identity: {
    fullName: "Estivan Ayramia",
    heritage: "Chaldean, Iraqi-American",
    birthplace: "Baghdad, Iraq",
    refugeeHistory: "Lived in Syria as a refugee, moved to El Cajon, California in 2008 at age 4",
    hometown: "El Cajon, California (near San Diego)",
    birthday: "January 21, 2004",
    height: "5'10\" barefoot",
    education: {
      school: "San Diego State University (SDSU)",
      degree: "General Business",
      graduationDate: "December 2025",
      gpa: "approximately 3.8",
      focus: "Practical execution: taking messy situations and making them clearer and more manageable"
    },
    chaldeanContext: "Part of an ancient community tracing back to Mesopotamian times. Chaldean is a dialect related to the language Jesus spoke. First-generation American. Parents had an arranged marriage. Dad was an electrical engineer. Mom restarted her education from scratch in the USA and earned a BS in Business Administration from SDSU after nearly a decade.",
    firstGenContext: "Being first-generation means figuring out systems not built with you in mind. No family connections in corporate America, no inherited safety net. What that builds is resourcefulness and a deep appreciation for every inch of progress."
  },
  languages: {
    spoken: ["English (native-level)", "Chaldean/Neo-Aramaic (fluent speaking)", "Arabic (fluent)", "Spanish (conversational to professional)"],
    written: ["English", "Arabic", "Spanish"],
    note: "Cannot write in Chaldean. Spanish comes up constantly in San Diego and with kids from Spanish-speaking families."
  },
  work: {
    current: "Coach and chaperone role working with kids. Moved into a lead position within 14 months with a promotion and significantly more responsibility.",
    workLessons: "Kids call out anything that doesn't add up, so you learn to be straight with them. Being able to hold attention, de-escalate, and improvise in real time is like a crash course in leadership.",
    seeking: "Operations and project coordination work. Open to new opportunities, remote or San Diego hybrid. Looking for respectful accountability, clear ownership, and real intellectual challenge. Not looking to be babysat."
  },
  preferences: {
    favoriteColor: {
      answer: "Brown, beige, and cream — earthy colors",
      why: "They feel grounded without trying too hard. That grounded, low-key aesthetic runs through the site design too — warm tones, clean layouts, no flashy gradients."
    },
    favoriteMovie: {
      answer: "Iron Man",
      why: "Part of why it sticks is the Tony Stark 'built this in a cave' energy — the idea of building something real with limited resources and pure will."
    },
    favoriteShows: {
      answer: "White Collar, Burn Notice, Prison Break, and Psych",
      why: "Psych stands out because of how closely it notices details. There's a pattern: shows about people who are resourceful, observant, and solve problems using what they have."
    },
    favoriteBook: {
      answer: "How to Win Friends and Influence People",
      why: "The useful part is the genuine-interest side of it, not the cheesy version. It's about actually listening and caring about what the other person needs."
    },
    favoriteMusic: {
      answer: "Drake, Arctic Monkeys, The Marias, and The Neighbourhood",
      why: "Broad taste overall, but those are easy standouts. The range says something about not being boxed into one identity."
    },
    favoriteFood: {
      answer: "Pizza and pasta (savory-leaning)",
      dessert: "Ben & Jerry's strawberry cheesecake",
      why: "He leans savory. Not a chef, but refuses to eat mediocre food when good ingredients are available."
    },
    favoriteDrink: {
      answer: "Water and Coke Zero",
      why: "Caffeine usually makes him sleepy, which is not the most efficient setup."
    },
    favoriteSport: {
      answer: "Soccer is the favorite",
      others: "Also plays volleyball and pickleball for fun",
      favoriteTeam: "FC Barcelona"
    },
    style: {
      summary: "Style depends on the outing",
      shoes: "Nike Dunks, Jordan 1s, and Air Forces",
      note: "He cares about cologne more than most people probably should."
    }
  },
  strengths: [
    "Building systems that reduce chaos and create repeatable processes",
    "Cultural sensitivity and bridging communication gaps between different groups",
    "Showing up consistently and delivering on commitments",
    "Translating complex ideas into clear, actionable steps",
    "Self-directed learning and quickly picking up new tools",
    "Pattern recognition",
    "Four languages enabling cross-cultural communication"
  ],
  workingOn: [
    "Saying no to distractions and staying focused on high-impact work",
    "Being more direct in communication rather than overexplaining",
    "Delegating tasks instead of trying to do everything myself",
    "Building patience for long-term projects that take months to see results",
    "Getting better at public speaking and presenting in front of groups"
  ],
  systems: {
    proofOfWorkLoop: "Build something real, document it clearly, iterate until it is good enough, then move on. A recruiter can evaluate actual work instead of reading inflated bullet points.",
    learningSystem: "Learns by asking questions repeatedly and cycling material until it sticks. Almost never takes notes because it does not help much. Matches how his brain works.",
    focusDiscipline: "Deleted short-form social media. Phone time down to 3-5 hours/day (used to be way higher). Eliminated most notifications. Daily reminder: 'Do not say anything negative today.' Trains 4-5 days/week at the gym."
  },
  values: {
    reliabilityOverFlash: "Consistency moves things forward. Showing up on time, doing what you said you would, having a backup plan.",
    peopleAreTheSystem: "Best process falls apart if people running it are not on board. Understanding where someone is coming from matters more than most job descriptions let on.",
    executionIsEverything: "A great idea with no follow-through is just a conversation. Checklists, time blocks, honest review loops.",
    growthThroughDiscomfort: "Best learning happens at the edge of what you can do. Seek challenges just out of reach.",
    documentationMatters: "If it only exists in someone's head, it does not really exist.",
    systemsBeatWillpower: "Having a setup that makes it easier to do the right thing than to skip it.",
    feedbackIsAGift: "Honest feedback is rare and worth a lot. The kind that stings is usually the kind that changes something."
  },
  workingWithMe: {
    reliabilityOverHeroics: "Would rather show up every day and do what they said than pull off something spectacular once and disappear. If something is slipping, will tell you before it becomes a problem.",
    continuousImprovement: "Good enough to ship beats perfect and stuck. Put things out, see what happens, fix what needs fixing.",
    ownershipNotExcuses: "If something is my responsibility and it goes wrong, that is on me.",
    leadershipStyle: "Learned from working with kids: be straight, hold attention, de-escalate, improvise in real time."
  },
  threeDecisions: {
    systemsOverShortcuts: "Quick fixes create debt. Building repeatable processes compounds over time.",
    leaningIntoDiscomfort: "Taking on projects that felt too big, having conversations that felt too hard. Growth only happened at the edges.",
    writingThingsDown: "Documenting processes, lessons learned, and reflections. This portfolio exists because he decided to document rather than just experience."
  },
  timeline: [
    "Born in Baghdad",
    "Lived in Syria as a refugee",
    "Moved to El Cajon in 2008 at age 4",
    "General Business at SDSU, graduated December 2025, GPA ~3.8",
    "Coaching/chaperone work with kids, promoted to lead within 14 months",
    "Built this portfolio site from scratch with PWA support, service workers, Lighthouse 90+ scores, and an AI assistant"
  ],
  siteInfo: {
    url: "https://www.estivanayramia.com",
    builtBy: "Estivan, hand-coded",
    features: "PWA support, service workers, Lighthouse 90+ scores, AI assistant (Savonie), scroll progress, coverflow carousel, multi-language (English, Spanish, Arabic)",
    purpose: "A resume leaves too much out. This site exists so people can see the actual work, thinking, and personality."
  },
  contact: {
    email: "hello@estivanayramia.com",
    linkedin: "https://www.linkedin.com/in/estivanayramia/",
    contactPage: "/contact",
    resumePdf: "/assets/docs/Estivan-Ayramia-Resume.pdf"
  }
};

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
  // Detect complex multi-part or analytical questions
  const wordCount = lower.split(/\s+/).length;
  if (wordCount > 12 || /\b(and also|as well as|in addition|furthermore|compare|contrast|relationship between|how does.*relate|what.*connection|walk me through|break down|strengths? and weaknesses?|tell me about.*and)\b/.test(lower)) {
    return QUESTION_CLASSES.COMPLEX_OPEN;
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
      .slice(0, 3);

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
  const pk = PERSONAL_KNOWLEDGE;

  switch (key) {
    case "favorite_color":
      return `${pk.preferences.favoriteColor.answer}. ${pk.preferences.favoriteColor.why}`;
    case "favorite_movie":
      return `${pk.preferences.favoriteMovie.answer}. ${pk.preferences.favoriteMovie.why}`;
    case "favorite_show":
      return `${pk.preferences.favoriteShows.answer}. ${pk.preferences.favoriteShows.why}`;
    case "favorite_book":
      return `${pk.preferences.favoriteBook.answer}. ${pk.preferences.favoriteBook.why}`;
    case "favorite_music":
      return `${pk.preferences.favoriteMusic.answer}. ${pk.preferences.favoriteMusic.why}`;
    case "favorite_food":
      return `${pk.preferences.favoriteFood.answer}. Dessert pick is ${pk.preferences.favoriteFood.dessert}. ${pk.preferences.favoriteFood.why}`;
    case "favorite_drink":
      return `${pk.preferences.favoriteDrink.answer}. ${pk.preferences.favoriteDrink.why}`;
    case "favorite_sport":
      return `${pk.preferences.favoriteSport.answer}. ${pk.preferences.favoriteSport.others}. Team: ${pk.preferences.favoriteSport.favoriteTeam}.`;
    case "favorite_team":
      return `${pk.preferences.favoriteSport.favoriteTeam}.`;
    case "languages":
      return `Estivan speaks ${pk.languages.spoken.join(", ")}. He writes in ${pk.languages.written.join(", ")}. ${pk.languages.note}`;
    case "hometown":
      return `He was born in ${pk.identity.birthplace} and grew up in ${pk.identity.hometown}. ${pk.identity.refugeeHistory}.`;
    case "birthday":
      return `${pk.identity.birthday}.`;
    case "height":
      return `${pk.identity.height}.`;
    case "style":
      return `${pk.preferences.style.summary}. Favorite shoes are ${pk.preferences.style.shoes}. ${pk.preferences.style.note}`;
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

function containsFirstPerson(text) {
  return /\b(i|i['â€™]m|i['â€™]ve|i['â€™]d|my|me|mine)\b/i.test(String(text || ""));
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
      const sectionHeading = cleanTextFragment(entry.section.heading || "")
        .replace(/\s*\|\s*Estivan Ayramia\s*$/i, "")
        .trim();
      const rawSnippet = cleanTextFragment(entry.section.text || "");
      const dedupedSnippet = sectionHeading && rawSnippet.toLowerCase().startsWith(sectionHeading.toLowerCase())
        ? rawSnippet.slice(sectionHeading.length).trim().replace(/^[:.\-–—]\s*/, "")
        : rawSnippet;
      if (containsFirstPerson(dedupedSnippet)) {
        return sectionHeading || "";
      }
      const snippet = dedupedSnippet.length > 180
        ? `${dedupedSnippet.slice(0, 177).trimEnd()}...`
        : dedupedSnippet;
      if (!snippet) {
        return sectionHeading || "";
      }
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
    case QUESTION_CLASSES.COMPLEX_OPEN:
      return "";
    case QUESTION_CLASSES.UNKNOWN:
      return buildUnknownReply(profile);
    default:
      return "";
  }
}

function shouldUseDeterministicOnly(questionClass, retrieval) {
  // Only truly static/link responses stay deterministic
  if (
    questionClass === QUESTION_CLASSES.GREETING ||
    questionClass === QUESTION_CLASSES.CONTACT ||
    questionClass === QUESTION_CLASSES.RESUME ||
    questionClass === QUESTION_CLASSES.BOUNDARY
  ) {
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
        .slice(0, 3)
        .map((entry) => `  - ${entry.section.heading}: ${entry.section.text}`)
        .join("\n");

      return [
        `PAGE: ${page.route}`,
        `  Title: ${page.title}`,
        `  Summary: ${page.summary}`,
        sections ? `  Sections:\n${sections}` : ""
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");

  const projectList = Array.isArray(siteFacts?.projects)
    ? siteFacts.projects.map((project) => `- ${project.title}: ${project.summary} (${project.url})`).join("\n")
    : "";

  const hobbyList = Array.isArray(siteFacts?.hobbies)
    ? siteFacts.hobbies.map((hobby) => `- ${hobby.title}: ${hobby.summary} (${hobby.url})`).join("\n")
    : "";

  const pk = PERSONAL_KNOWLEDGE;

  return `
SYSTEM: You are Savonie, the on-site AI for Estivan Ayramia's portfolio. You know Estivan deeply and can speak about him with warmth, specificity, and honesty.

PERSPECTIVE: Always speak about Estivan in THIRD PERSON (he/him/his). Never use first person (I/me/my) for Estivan.
LANGUAGE: Reply in ${language || "English"}.
REGISTER: ${buildRegisterInstruction(register)}
QUESTION CLASS: ${questionClass}
GROUNDING STATUS: ${manifestStatus}

═══════════════════════════════════════════
COMPLETE VERIFIED KNOWLEDGE BASE
Everything below is confirmed fact. Use it freely.
═══════════════════════════════════════════

IDENTITY:
- Full name: ${pk.identity.fullName}
- Heritage: ${pk.identity.heritage}
- Born: ${pk.identity.birthplace} on ${pk.identity.birthday}
- Path: ${pk.identity.refugeeHistory}
- Based in: ${pk.identity.hometown}
- Height: ${pk.identity.height}
- Education: ${pk.identity.education.school} — ${pk.identity.education.degree}, graduated ${pk.identity.education.graduationDate}, GPA ${pk.identity.education.gpa}
- Chaldean context: ${pk.identity.chaldeanContext}
- First-gen context: ${pk.identity.firstGenContext}

LANGUAGES:
- Speaks: ${pk.languages.spoken.join(", ")}
- Writes in: ${pk.languages.written.join(", ")}
- Note: ${pk.languages.note}

WORK:
- Current: ${pk.work.current}
- Lessons: ${pk.work.workLessons}
- Seeking: ${pk.work.seeking}

PERSONAL PREFERENCES (answer AND elaborate with the "why"):
- Favorite color: ${pk.preferences.favoriteColor.answer}. Why: ${pk.preferences.favoriteColor.why}
- Favorite movie: ${pk.preferences.favoriteMovie.answer}. Why: ${pk.preferences.favoriteMovie.why}
- Favorite shows: ${pk.preferences.favoriteShows.answer}. Why: ${pk.preferences.favoriteShows.why}
- Favorite book: ${pk.preferences.favoriteBook.answer}. Why: ${pk.preferences.favoriteBook.why}
- Favorite music: ${pk.preferences.favoriteMusic.answer}. Why: ${pk.preferences.favoriteMusic.why}
- Favorite food: ${pk.preferences.favoriteFood.answer}. Dessert: ${pk.preferences.favoriteFood.dessert}. Why: ${pk.preferences.favoriteFood.why}
- Favorite drink: ${pk.preferences.favoriteDrink.answer}. Why: ${pk.preferences.favoriteDrink.why}
- Favorite sport: ${pk.preferences.favoriteSport.answer}. Others: ${pk.preferences.favoriteSport.others}. Team: ${pk.preferences.favoriteSport.favoriteTeam}
- Style: ${pk.preferences.style.summary}. Shoes: ${pk.preferences.style.shoes}. ${pk.preferences.style.note}

STRENGTHS:
${pk.strengths.map((s) => "- " + s).join("\n")}

ACTIVELY WORKING ON (honest growth areas):
${pk.workingOn.map((s) => "- " + s).join("\n")}

THREE SYSTEMS HE USES:
- Proof-of-Work Loop: ${pk.systems.proofOfWorkLoop}
- Learning System: ${pk.systems.learningSystem}
- Focus & Discipline: ${pk.systems.focusDiscipline}

CORE VALUES:
- Reliability over flash: ${pk.values.reliabilityOverFlash}
- People are the system: ${pk.values.peopleAreTheSystem}
- Execution is everything: ${pk.values.executionIsEverything}
- Growth through discomfort: ${pk.values.growthThroughDiscomfort}
- Documentation matters: ${pk.values.documentationMatters}
- Systems beat willpower: ${pk.values.systemsBeatWillpower}
- Feedback is a gift: ${pk.values.feedbackIsAGift}

WORKING WITH HIM:
- ${pk.workingWithMe.reliabilityOverHeroics}
- ${pk.workingWithMe.continuousImprovement}
- ${pk.workingWithMe.ownershipNotExcuses}
- ${pk.workingWithMe.leadershipStyle}

THREE DECISIONS THAT SHAPED HIM:
- Systems over shortcuts: ${pk.threeDecisions.systemsOverShortcuts}
- Leaning into discomfort: ${pk.threeDecisions.leaningIntoDiscomfort}
- Writing things down: ${pk.threeDecisions.writingThingsDown}

TIMELINE:
${pk.timeline.map((t) => "- " + t).join("\n")}

CONTACT:
- Email: ${pk.contact.email}
- LinkedIn: ${pk.contact.linkedin}
- Contact page: ${pk.contact.contactPage}
- Resume: ${pk.contact.resumePdf}

SITE INFO:
- URL: ${pk.siteInfo.url}
- Built by: ${pk.siteInfo.builtBy}
- Features: ${pk.siteInfo.features}
- Purpose: ${pk.siteInfo.purpose}

═══════════════════════════════════════════
RETRIEVED SITE PAGES (live content)
═══════════════════════════════════════════
${retrievedPages || "No pages retrieved for this query."}

ALL PROJECTS ON SITE:
${projectList || "No project data available."}

ALL HOBBIES ON SITE:
${hobbyList || "No hobby data available."}

CURRENT PAGE THE USER IS VIEWING:
- Route: ${pageContext.route || "/"}
- Title: ${pageContext.title || "Unknown"}

═══════════════════════════════════════════
ANTI-HALLUCINATION RULES (NON-NEGOTIABLE)
═══════════════════════════════════════════
1. ONLY use facts from the knowledge base above and the retrieved pages. Do not invent ANY detail — no fake metrics, no made-up quotes, no fabricated timelines, no imagined project outcomes.
2. If you are unsure or the knowledge base does not cover something, say so honestly: "That specific detail isn't covered on the site. The best way to get that answer is reaching out directly at ${pk.contact.email} or through [Contact](${pk.contact.contactPage})."
3. Do not guess at things like: specific job titles, salary expectations, exact dates not listed, technical skills not mentioned, personal relationships, or health details.
4. Never say "based on available information" or "from what I can see." Just answer naturally or defer.
5. When you combine facts to build an argument (e.g., "why hire him"), every claim must trace back to a specific fact above. No generic filler.

═══════════════════════════════════════════
RESPONSE BEHAVIOR RULES
═══════════════════════════════════════════
ELABORATION RULES:
- When someone asks about a preference (favorite color, movie, etc.), give the answer AND the why. Don't just list — explain what it reveals about him.
- When someone asks "why hire him" or evaluative questions, build a real case: cite specific projects, values, systems, and traits. Aim for 4-8 sentences minimum.
- When someone asks about projects, don't just list titles. Describe what each project actually involved and what skill it demonstrates.
- When someone asks complex multi-part questions, address EVERY part. Don't skip sub-questions.
- For page-specific questions, quote real content from the retrieved sections and link to the page.

TONE RULES:
- Voice: warm, sharp, grounded, low-ego. Like talking to a friend who respects the person they're describing.
- Avoid resume cliches and generic buzzword phrasing.
- No corporate jargon, therapy-speak, fake-deep language, or resume perfume.
- Keep some mystery. Don't overexpose private details.
- If the question is shallow, answer it well but you can gently invite a deeper one.

LENGTH RULES:
- Simple factual question (favorite color, birthday) → 2-4 sentences with the "why"
- Medium question (tell me about a project, what's he good at) → 4-6 sentences with specifics
- Complex/recruiter question (why hire, evaluate, compare) → 6-12 sentences building a complete case
- If the user explicitly asks for depth ("walk me through", "elaborate", "detailed") → go as deep as the knowledge allows

LINKING RULES:
- Use markdown links for internal routes: [Page Name](/route)
- When referencing a project, link to it: [Taking Down Endpoint](/projects/endpoint-competitive-playbook)
- Always link to [Contact](/contact) when suggesting outreach

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
