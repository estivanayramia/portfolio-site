import {
  cleanTextFragment,
  createPageRecord,
  isRelevantInternalRoute,
  normalizeRoute,
  tokenizeText
} from "./chat-grounding-utils.mjs";

export const CHAT_VERSION = "v2026.03.30-savonie-v3";

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

// ═══════════════════════════════════════════════════════════════════════
// PERSONAL_KNOWLEDGE — Single source of truth for ALL personal facts.
// Every entry is verified from site content. Nothing is fabricated.
// Gemini receives this in every prompt so it NEVER has to guess.
// ═══════════════════════════════════════════════════════════════════════
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
      focus: "Practical execution — taking messy situations and making them clearer and more manageable"
    },
    chaldeanContext: "Part of an ancient community tracing back to Mesopotamian times. Chaldean is a dialect related to the language Jesus spoke. First-generation American. Parents had an arranged marriage. Dad was an electrical engineer. Mom restarted her education from scratch in the USA and earned a BS in Business Administration from SDSU after nearly a decade of classes.",
    firstGenContext: "Being first-generation means figuring out systems not built with you in mind. No family connections in corporate America, no inherited safety net. What that builds is resourcefulness and a deep appreciation for every inch of progress."
  },
  languages: {
    spoken: ["English (native-level)", "Chaldean/Neo-Aramaic (fluent speaking)", "Arabic (fluent)", "Spanish (conversational to professional)"],
    written: ["English", "Arabic", "Spanish"],
    note: "Cannot write in Chaldean. Spanish comes up constantly in San Diego and with kids from Spanish-speaking families."
  },
  work: {
    current: "Coach and chaperone role working with kids. Moved into a lead position within 14 months with a promotion and significantly more responsibility.",
    workLessons: "Kids call out anything that does not add up, so you learn to be straight with them. Being able to hold attention, de-escalate, and improvise in real time is like a crash course in leadership.",
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
      why: "Psych stands out because of how closely it notices details. There is a pattern across all of them: shows about people who are resourceful, observant, and solve problems using what they have."
    },
    favoriteBook: {
      answer: "How to Win Friends and Influence People",
      why: "The useful part is the genuine-interest side of it, not the cheesy version. It is about actually listening and caring about what the other person needs."
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
      summary: "His style depends on the outing",
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
    "Pattern recognition — noticing where things break down before they become real problems",
    "Four languages enabling cross-cultural communication in professional settings"
  ],
  workingOn: [
    "Saying no to distractions and staying focused on high-impact work",
    "Being more direct in communication rather than overexplaining",
    "Delegating tasks instead of trying to do everything himself",
    "Building patience for long-term projects that take months to see results",
    "Getting better at public speaking and presenting in front of groups"
  ],
  systems: {
    proofOfWorkLoop: "Build something real, document it clearly, iterate until it is good enough, then move on. A recruiter can evaluate actual work instead of reading inflated bullet points.",
    learningSystem: "Learns by asking questions repeatedly and cycling material until it sticks. Almost never takes notes because it does not help much. Matches how his brain works — and it is consistent with finishing General Business on track with a strong GPA.",
    focusDiscipline: "Deleted short-form social media because it is too easy to waste hours. Phone time down to about 3-5 hours/day (used to be way higher). Eliminated most notifications because constant buzzing hijacks attention. Daily reminder he actually uses: 'Do not say anything negative today.' Trains 4-5 days/week at the gym — it is where his mind quiets down and focus locks in."
  },
  values: {
    reliabilityOverFlash: "Consistency is what actually moves things forward. Showing up on time, doing what you said you would, and having a backup plan when things go sideways. It is not exciting, but it is what makes people trust you.",
    peopleAreTheSystem: "The best process in the world falls apart if the people running it are not on board. Understanding where someone is coming from, communicating clearly, and knowing how to work through friction matters more than most job descriptions let on.",
    executionIsEverything: "A great idea with no follow-through is just a conversation. Checklists, time blocks, and honest review loops are what separate things that actually ship from things that live forever in a Notes app.",
    growthThroughDiscomfort: "The best learning happens right at the edge of what you can actually do. Seek out challenges that feel just a bit out of reach, write down what goes wrong, adjust, and keep going.",
    documentationMatters: "If it only exists in someone's head, it does not really exist. Written records become reference material that compounds over time.",
    systemsBeatWillpower: "Motivation is great when it shows up. It does not always show up. What actually keeps things moving is having a setup that makes it easier to do the right thing than to skip it.",
    feedbackIsAGift: "Feedback that is actually honest is rare and worth a lot. The kind that stings a little is usually the kind that changes something."
  },
  workingWithMe: {
    reliabilityOverHeroics: "Would rather be the person who shows up every day and does what they said than the person who pulls off something spectacular once and disappears. If something is slipping, will tell you before it becomes a problem. No surprises.",
    continuousImprovement: "Good enough to ship beats perfect and stuck. Put things out, see what actually happens, and fix what needs fixing. The first version is mostly just a question — the next version is where the real answer shows up.",
    ownershipNotExcuses: "If something is his responsibility and it goes wrong, that is on him. Fix it, understand what happened, and make sure it does not happen the same way again.",
    leadershipStyle: "Learned from working with kids: be straight, hold attention, de-escalate, and improvise in real time. You cannot fake it with kids — they know when you are being real."
  },
  threeDecisions: {
    systemsOverShortcuts: "Early on, he realized that quick fixes create debt. Every time he chose to build a repeatable process instead of just solving the immediate problem, it compounded. Now he spends less time firefighting because the systems handle the predictable stuff.",
    leaningIntoDiscomfort: "Taking on projects that felt too big, having conversations that felt too hard, and putting himself in situations where failure was possible. The growth only happened at the edges of what he could handle. Staying comfortable meant staying stuck.",
    writingThingsDown: "Documenting processes, lessons learned, and reflections. Most people skip this step because it feels like extra work. But written records become reference material that compounds. This portfolio exists because he decided to document rather than just experience."
  },
  timeline: [
    "Born in Baghdad, Iraq",
    "Lived in Syria as a refugee",
    "Moved to El Cajon, California in 2008 at age 4",
    "General Business at SDSU, graduated December 2025, GPA approximately 3.8",
    "Coaching/chaperone work with kids — promoted to lead within 14 months",
    "Directed this portfolio site using AI development tools (Claude, Copilot, Gemini) with PWA support, service workers, Lighthouse 90+ scores, and an AI assistant (Savonie)"
  ],
  siteInfo: {
    url: "https://www.estivanayramia.com",
    builtBy: "Estivan directing AI tools — AI wrote every line of code, Estivan designed, reviewed, and shipped",
    features: "PWA support, service workers, Lighthouse 90+ scores, AI chatbot (Savonie), scroll progress, coverflow carousel, multi-language support (English, Spanish, Arabic), dark/light theme",
    purpose: "A resume leaves too much out. This site exists so people can see the actual work, thinking, and personality — not just bullet points."
  },
  contact: {
    email: "hello@estivanayramia.com",
    linkedin: "https://www.linkedin.com/in/estivanayramia/",
    contactPage: "/contact",
    resumePdf: "/assets/docs/Estivan-Ayramia-Resume.pdf"
  }
};

const SURFACE_FACT_PATTERNS = [
  { key: "favorite_color", pattern: /\b(favo[u]?rite|like).*(color|colour)|what.*(color|colour).*(like|favorite)\b/i },
  { key: "favorite_movie", pattern: /\b(favo[u]?rite|best).*movie|what.*movie.*(favorite|like)\b/i },
  { key: "favorite_show", pattern: /\b(favo[u]?rite|best).*(show|shows|series)|what.*(tv|show|series).*(favorite|watch)\b/i },
  { key: "favorite_book", pattern: /\b(favo[u]?rite|best).*book|what.*book.*(favorite|like)\b/i },
  { key: "favorite_music", pattern: /\b(favo[u]?rite|best).*(music|artist|artists|band|bands)|what.*(listen to|music|artist|band)\b/i },
  { key: "favorite_food", pattern: /\b(favo[u]?rite|best).*(food|foods|meal)|what.*(eat|food|meal|dessert|pizza|pasta)\b/i },
  { key: "favorite_drink", pattern: /\b(favo[u]?rite|best).*(drink|drinks)|what.*(drink|coffee|caffeine|coke zero|water)\b/i },
  { key: "favorite_team", pattern: /\bbarcelona|fc barcelona|favorite team|sports team\b/i },
  { key: "favorite_sport", pattern: /\b(favo[u]?rite|best).*(sport|sports)|what.*sport.*(favorite|play)\b/i },
  { key: "languages", pattern: /\blanguages?|speak|write in|english|arabic|chaldean|spanish\b/i },
  { key: "education", pattern: /\b(education|graduat(e|ed|ion)|degree|college|university|school|sdsu|major|studied)\b/i },
  { key: "birthday", pattern: /\bbirthday\b|\bborn on\b|\bwhen.*born\b|\bage\b|\bhow old\b|\bold is\b/i },
  { key: "hometown", pattern: /\bwhere.*from|hometown|grew up|el cajon|baghdad|born in\b/i },
  { key: "height", pattern: /\bheight|how tall|tall\b/i },
  { key: "style", pattern: /\bstyle|dress|clothes|fashion|shoes|cologne|jewelry\b/i },
  { key: "work", pattern: /\bcurrent (job|role|work)|what does he do for (work|a living)|where does he work|coach|549 sports\b/i },
  { key: "gpa", pattern: /\bgpa|grade point|grades\b/i },
  { key: "strengths", pattern: /\bstrengths?|good at|best at|strongest\b/i },
  { key: "weaknesses", pattern: /\bweakness(es)?|working on|improving|growth area\b/i },
  { key: "hobbies", pattern: /\bhobb(y|ies)|free time|fun|do for fun|outside work\b/i },
  { key: "car", pattern: /\b(bmw|540i|mods|modification)\b|\bhis car\b|\bcar mods\b|\bwhat car\b/i },
  { key: "skills", pattern: /\b(crm|salesforce|hubspot|pardot|certif)\b|\bhis skills\b|\bwhat skills\b|\btools does he\b|\bcrm tools\b|\bwhat tools\b|\btechnical skills\b/i },
  { key: "heritage", pattern: /\b(chaldean|refugee|iraqi?)\b|\bhis (heritage|background)\b/i },
  { key: "family", pattern: /\b(brother|sibling|parent)s?\b|\bhis (mom|dad|father|mother|family)\b|\bdoes he have (brothers|siblings|family)\b/i },
  { key: "values", pattern: /\bhis values\b|\bwhat does he value\b|\bwhat.*believe\b|\bwork ethic\b|\bphilosophy\b/i },
  { key: "zodiac", pattern: /\bzodiac|star sign|astrolog|aquarius\b/i }
];

function now() {
  return Date.now();
}

function withTrailingSlash(baseUrl) {
  return String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`']/g, "")
    .replace(/[^a-z0-9\s/'-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\bloral\b/g, "loreal");
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
      birthday: "January 21, 2004",
      birthplace: "Baghdad, Iraq",
      height: "5'10\" barefoot",
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
    projects: [
      {
        id: "taking-down-endpoint",
        title: "Taking Down Endpoint (Competitive Playbook)",
        class: "MKTG 476 Interactive Marketing, SDSU",
        instructor: "Isa Grimes (CMO at Endpoint Clinical)",
        estivanRole: "Strategy, Website & 3rd Party",
        format: "20+ page competitive strategy deck",
        summary: "Competitive playbook analyzing Almac, 4G Clinical, and other competitors to Endpoint Clinical. Includes SWOT analysis, positioning strategy, SEO/SEM/LLM optimization, marketing automation workflows, and analytics framework.",
        keyInsights: ["Competitor positioning gaps", "SEO and LLM optimization strategy", "Marketing automation flows", "Analytics integration"],
        whatItProves: "Strategic thinking, competitive analysis, synthesizing complex market data into actionable positioning",
        url: "/projects/endpoint-competitive-playbook"
      },
      {
        id: "endpoint-linkedin-campaign",
        title: "Endpoint LinkedIn Campaign",
        class: "MKTG 476 Interactive Marketing, SDSU",
        instructor: "Isa Grimes (CMO at Endpoint Clinical)",
        format: "15-page LinkedIn campaign plan deck",
        summary: "Phase 2A and 2B retargeting strategy. Phase 2A: qualified leads via carousel retargeting. Phase 2B: deeper interest via video retargeting. Includes KPI targets, kill/scale rules, and experiment hypotheses.",
        keyInsights: ["Phase-based campaign architecture", "Retargeting from awareness to conversion", "KPI targets per phase", "Kill/scale rules for budget optimization"],
        whatItProves: "Campaign planning discipline, metrics-driven marketing, structured phased execution",
        url: "/projects/endpoint-linkedin-campaign"
      },
      {
        id: "franklin-templeton",
        title: "Franklin Templeton x Mashable ME Partnership",
        class: "MKTG 476 Interactive Marketing, SDSU",
        instructor: "Isa Grimes",
        format: "17-page concept deck (English + Arabic version)",
        summary: "Campaign concept targeting women investors in the UAE. Estivan built the Arabic version of the deck, reviewed by his family for accuracy. Women make up ~8% of UAE ETF investors, growing 18% in 5 years.",
        keyInsights: ["Dual-language content creation", "Community-driven engagement", "Social media pivot for traditional brand", "UAE women investor market opportunity"],
        whatItProves: "Multilingual content creation, cultural sensitivity, market research, bilingual campaign execution",
        url: "/projects/franklin-templeton-concept"
      },
      {
        id: "loreal-cell-bioprint",
        title: "L'Oréal Cell BioPrint MAPS Campaign",
        class: "MKTG 476 Interactive Marketing, SDSU",
        instructor: "Isa Grimes",
        format: "Full MAPS campaign deck",
        summary: "Campaign mapping three personas (Margaret the consumer, Madison the medspa, Ida the influencer) across the marketing funnel. Touchpoints by stage: ads, landing pages, website triggers, email, and retention.",
        keyInsights: ["Three distinct persona profiles", "Touchpoints by funnel stage", "One funnel across all personas", "Positioning and target market segmentation"],
        whatItProves: "Persona-driven marketing, funnel architecture, touchpoint mapping, audience segmentation",
        url: "/projects/loreal-maps-campaign"
      },
      {
        id: "isa-grimes-interview",
        title: "Isa Grimes Interview",
        format: "Editorial interview feature",
        summary: "A real conversation with Isa Grimes (CMO at Endpoint Clinical, SDSU professor) about your 20s, people skills, leadership, favoritism, support systems, and why the fastest route is not always the right one.",
        keyInsights: ["People judgment matters more than titles", "Leadership is reading situations and adapting", "Mentorship and support systems", "Patience over quick wins"],
        whatItProves: "Interview ability, people skills, editorial thinking, relationship building",
        url: "/projects/isa-grimes-interview"
      },
      {
        id: "endpoint-elosity-video",
        title: "Endpoint Elosity Video Concept",
        format: "49-second video concept (unlisted YouTube)",
        summary: "Solo video for Endpoint's Elosity platform. Made with no prior video production experience using Google Gemini Veo 3.0, CapCut Pro, and audio tools.",
        whatItProves: "Willingness to learn new tools, creative problem-solving, self-directed execution",
        url: "/projects/endpoint-elosity-video"
      },
      {
        id: "this-website",
        title: "This Website (Portfolio)",
        format: "Full-stack portfolio site",
        summary: "Started late November 2025 with no coding background. Over 300 hours of directing, reviewing, and shipping. AI wrote every line of code (Claude, Copilot, Gemini). Estivan designed, reviewed, and shipped.",
        whatItProves: "Initiative, follow-through, quality standards, ability to direct complex technical work",
        url: "/projects/portfolio"
      }
    ],
    resume: {
      coreSkills: ["Consultative recommendations", "Upselling", "Objection handling", "Service recovery", "CRM exposure (Salesforce, HubSpot, Pardot)", "Google Analytics Certification", "Microsoft Clarity", "Multilingual communication"],
      experience: [
        { role: "Sports Coach", company: "549 Sports LLC", dates: "Sep 2024 – Present", key: "Supervise 20-80 children per session, multilingual communication, incident reports" },
        { role: "Retail Sales Associate", company: "Convenience Retail and Fuel", dates: "Sept 2023 – Aug 2024", key: "Upper-four-digit daily sales, 8-12 customers at peak, inventory reorganization" },
        { role: "Store Associate", company: "Del Sol Market", dates: "May – Aug 2023", key: "30-100 transactions per shift, alternative suggestions increasing basket size" },
        { role: "Independent Contractor", company: "Delivery Services", dates: "2021 – 2022", key: "40-70 deliveries/week, ~4.9/5 rating" }
      ],
      education: { school: "SDSU", degree: "BS Business Administration (General Business)", graduation: "Dec 18, 2025", gpa: "3.71" }
    },
    hobbies: [],
    meta: {
      projectCount: 0,
      hobbyCount: 0,
      source: "Minimal fallback"
    }
  };
}

function sanitizeConversationHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];

  return rawHistory
    .slice(-8)
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;

      if (entry.kind === "card" && entry.cardId) {
        return {
          kind: "card",
          cardId: cleanTextFragment(entry.cardId).slice(0, 120)
        };
      }

      if (entry.kind === "text" && entry.sender && entry.text) {
        return {
          kind: "text",
          sender: cleanTextFragment(entry.sender).slice(0, 16),
          text: cleanTextFragment(entry.text).slice(0, 500)
        };
      }

      return null;
    })
    .filter(Boolean);
}

function isAmbiguousFollowUp(message) {
  const lower = String(message || "").toLowerCase().trim();
  if (!lower) return false;
  if (lower.length <= 72 && /\b(it|that|this|those|them|he|his|him|more|deeper|why|how so|what about that|and that|tell me more)\b/i.test(lower)) {
    return true;
  }
  return /^(and|also|more|why|how|what about that|tell me more)/i.test(lower);
}

function buildHistoryAwareQuery(message, history) {
  const current = cleanTextFragment(message || "");
  if (!history.length) return current;
  if (!isAmbiguousFollowUp(current)) return current;

  const previousUser = [...history]
    .reverse()
    .find((entry) => entry.kind === "text" && entry.sender === "user" && cleanTextFragment(entry.text) !== current);
  const parts = [current];
  if (previousUser?.text) {
    parts.push(`Previous user question: ${previousUser.text}`);
  }

  return cleanTextFragment(parts.join(" "));
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
    .filter((page) => page.route && isRelevantInternalRoute(page.route));

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

async function loadJsonFromUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });
    if (!response?.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function primeFallbackGrounding(env, baseUrl) {
  if (!env) return;

  if (!env.__SITE_FACTS) {
    env.__SITE_FACTS = await loadJsonFromUrl(`${withTrailingSlash(baseUrl)}/assets/data/site-facts.json`);
  }

  if (!env.__PAGE_MANIFEST) {
    env.__PAGE_MANIFEST = await loadJsonFromUrl(`${withTrailingSlash(baseUrl)}/assets/data/chat-page-manifest.json`);
  }

  if (!env.__CHAT_PROFILE) {
    env.__CHAT_PROFILE = await loadJsonFromUrl(`${withTrailingSlash(baseUrl)}/data/chat/estivan-profile.public.json`);
  }
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
  const lower = normalizeComparableText(message);

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
  const lower = normalizeComparableText(message);

  if (!lower) return QUESTION_CLASSES.UNKNOWN;
  if (/^(hi|hello|hey|yo|sup|what's up|whats up|good morning|good afternoon|good evening|lol|lmao|haha|bruh|ayy|what is this|what even is this)\b/.test(lower) || /^(who are you|what can you do|help|what is this)$/i.test(lower)) {
    return QUESTION_CLASSES.GREETING;
  }
  if (/\b(contact|email|reach out|reach him|reach you|linkedin)\b/.test(lower)) {
    return QUESTION_CLASSES.CONTACT;
  }
  if (/\b(resume|cv|download)\b/.test(lower)) {
    return QUESTION_CLASSES.RESUME;
  }
  if (/\b(why hire|more experience|hire you|hire him|worth interviewing|recruiter|quick pitch|elevator pitch|sell me on|convince me|pitch me)\b/.test(lower)) {
    return QUESTION_CLASSES.HIRE_CASE;
  }
  if (/\b(mostly ai|just ai|is this ai|real skill|actually skilled|just chatgpt|just gpt|chatgpt with|gpt wrapper|ai wrapper|is savonie|savonie just)\b/.test(lower)) {
    return QUESTION_CLASSES.SKEPTICAL_AI;
  }
  if (/\b(code|coded|built|build|develop|hand.?code|program)\b/.test(lower) && /\b(this site|himself|herself|alone|scratch|from scratch|by hand)\b/.test(lower)) {
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
  if (/\b(projects|work samples|what have you done|what projects|which project|recommend|start with|look at first|best project|top project|strongest|most impressive|what should I (see|look|check|open))\b/i.test(lower)) {
    return QUESTION_CLASSES.PROJECT_LIST;
  }
  if (/\b(languages|speak|write in|english|arabic|chaldean|spanish)\b/.test(lower)) {
    return QUESTION_CLASSES.LANGUAGES;
  }
  if (/\b(sat|act|gpa|gmat|lsat|class rank|iq)\b/.test(lower)) {
    return QUESTION_CLASSES.UNKNOWN;
  }
  if (/\b(relationship|dating|girlfriend|boyfriend|ex|family drama|mental health|diagnosed|address|where exactly do you live|salary you make|phone number|ssn|social security|income|how much.*make|how much.*earn)\b/.test(lower)) {
    return QUESTION_CLASSES.BOUNDARY;
  }
  if (/\b(what's he about|whats he about|what is estivan about|what are you about|who are you|tell me about yourself|tell me about estivan|what does estivan do|what does he do|what do you do)\b/.test(lower)) {
    return QUESTION_CLASSES.ABOUT_GENERAL;
  }
  if (/\b(page|site|homepage|overview|deep dive|about|project page|hobbies|whispers|portfolio build|l[' ]?oreal|loreal|endpoint|franklin|cooking|reading|photography|me page)\b/.test(lower)) {
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
  const lower = normalizeComparableText(message);
  const match = SURFACE_FACT_PATTERNS.find((entry) => entry.pattern.test(lower));
  return match ? match.key : "";
}

function scorePage(page, queryTokens, message, questionClass) {
  const lower = normalizeComparableText(message);
  let score = 0;
  const route = String(page.route || "");
  const title = normalizeComparableText(page.title || "");
  const summary = normalizeComparableText(page.summary || "");
  const description = normalizeComparableText(page.description || "");
  const headings = normalizeComparableText((page.headings || []).join(" "));

  if (lower.includes(route.replace(/\/$/, "")) && route !== "/") score += 30;
  if (title && lower.includes(title)) score += 24;

  for (const token of queryTokens) {
    const normalizedToken = normalizeComparableText(token);
    if (!normalizedToken) continue;
    if (route.includes(normalizedToken)) score += 7;
    if (title.includes(normalizedToken)) score += 9;
    if (headings.includes(normalizedToken)) score += 6;
    if (summary.includes(normalizedToken)) score += 5;
    if (description.includes(normalizedToken)) score += 4;
    if ((page.keywords || []).map((keyword) => normalizeComparableText(keyword)).includes(normalizedToken)) score += 3;
  }

  if (questionClass === QUESTION_CLASSES.PAGE_SPECIFIC) {
    if (page.pageType === "project_detail" || page.pageType === "hobby_detail" || page.pageType === "about_detail") {
      score += 10;
    }
    if (/\bhobbies?\b/.test(lower) && /\b(hub|gateway|overview|main)\b/.test(lower)) {
      if (route === "/about") score += 30;
      if (route.startsWith("/about/") && route !== "/about") score += 8;
      if (page.pageType === "hobby_detail") score -= 18;
    }
    if (/\bprojects?\b|\bwork\b/.test(lower) && page.pageType === "projects_index") score += 18;
    if (/\babout\b/.test(lower) && page.route === "/about") score += 12;
  }

  if (questionClass === QUESTION_CLASSES.PROJECT_LIST && page.pageType === "projects_index") score += 12;
  if (questionClass === QUESTION_CLASSES.TEAM && (route === "/overview" || route === "/deep-dive" || route === "/about")) score += 8;
  if (questionClass === QUESTION_CLASSES.LANGUAGES && (route === "/overview" || route === "/about" || route === "/deep-dive" || route === "/es/" || route === "/ar/")) score += 8;
  if (questionClass === QUESTION_CLASSES.SITE_PROOF && (route === "/" || route === "/projects/portfolio")) score += 12;
  if (/\bl['']?or[ée]al|\bloreal\b/i.test(lower) && route.includes("loreal")) score += 40;
  if (/\bfranklin\b/i.test(lower) && route.includes("franklin")) score += 30;
  if (/\bisa\b|\bgrimes\b/i.test(lower) && route.includes("isa-grimes")) score += 30;
  if (/\bportfolio\b|\bthis website\b|\bsite build\b/i.test(lower) && route.includes("/projects/portfolio")) score += 34;
  if (/\bbackground\b|\bhis background\b|\btell me about his background\b/i.test(lower) && route === "/about/background") score += 36;
  if (/\bworking with people\b|\bworking with him\b|\bteam\b|\bcollaborat/i.test(lower) && route === "/about/working-with-me") score += 22;
  if (/\bl[' ]?oreal\b|\bloreal\b/.test(lower) && route.includes("loreal")) score += 48;
  if (/previous user question: .*background/.test(lower) && route === "/about/background") score += 56;
  if (/previous user question: .*working with/.test(lower) && route === "/about/working-with-me") score += 48;
  if (/previous user question: .*values?/.test(lower) && route === "/about/values") score += 44;
  if (/(previous user question: .*l[' ]?oreal|previous user question: .*loreal)/.test(lower) && route.includes("loreal")) score += 60;
  if (/(previous user question: .*portfolio|previous user question: .*this website|previous user question: .*site build)/.test(lower) && route.includes("/projects/portfolio")) score += 54;
  if (/\bl[' ]?oreal\b|\bloreal\b/.test(lower) && page.pageType === "projects_index") score -= 18;

  return score;
}

function scoreSection(page, section, queryTokens, message) {
  const lower = normalizeComparableText(message);
  let score = 0;
  const heading = normalizeComparableText(section.heading || "");
  const text = normalizeComparableText(section.text || "");

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

function formatBirthdayWithAge() {
  const birthday = PERSONAL_KNOWLEDGE.identity.birthday;
  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) {
    return birthday;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear = (
    today.getMonth() > birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())
  );

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return `He was born on ${birthday}, so he is ${age} right now.`;
}

function formatSurfaceFactReply(key) {
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
    case "education":
      return `He graduated from ${pk.identity.education.school} with a ${pk.identity.education.degree} degree in ${pk.identity.education.graduationDate}, with a GPA of ${pk.identity.education.gpa}. ${pk.identity.education.focus}.`;
    case "hometown":
      return `He was born in ${pk.identity.birthplace} and grew up in ${pk.identity.hometown}. ${pk.identity.refugeeHistory}.`;
    case "birthday":
      return formatBirthdayWithAge();
    case "height":
      return `${pk.identity.height}.`;
    case "style":
      return `${pk.preferences.style.summary}. Favorite shoes are ${pk.preferences.style.shoes}. ${pk.preferences.style.note}`;
    case "work":
      return pk.work?.current
        ? `${pk.work.current} ${pk.work.workLessons || ""} He is looking for: ${pk.work.seeking || "operations, coordination, or project support roles."}`
        : "Currently a Sports Coach at 549 Sports LLC, supervising 20-80 children per session. Previously worked in retail and delivery services. Looking for operations, coordination, or project support roles.";
    case "gpa":
      return `His GPA is ${pk.identity?.education?.gpa || "approximately 3.8"}. He graduated from ${pk.identity?.education?.school || "SDSU"} in ${pk.identity?.education?.graduationDate || "December 2025"} with a ${pk.identity?.education?.degree || "General Business"} degree.`;
    case "strengths":
      return pk.strengths?.length
        ? `His main strengths: ${pk.strengths.slice(0, 4).join("; ")}. The pattern across the site is systems thinking, clear communication, and consistent execution.`
        : "His main strengths: systems thinking, clear communication, consistency, and people judgment. The pattern across the site is figuring things out, structuring them, and following through.";
    case "weaknesses":
      return pk.workingOn?.length
        ? `What he is working on: ${pk.workingOn.slice(0, 3).join("; ")}. He is honest about growth areas, which is itself a strength.`
        : "He is working on: saying no to distractions, delegating instead of doing everything himself, and public speaking comfort. He is honest about growth areas, which is itself a strength.";
    case "hobbies":
      return `His hobbies include gym and strength training (4-5 days/week), photography, car enthusiasm (BMW with mods), cooking, and reading. He also has an [arcade games section](/hobbies-games) on the site.`;
    case "car":
      return `He drives a BMW that he has modified: MHD Stage 2 tune, cold air intake, upgraded CTS charge pipe, MAD turbo inlet, catless downpipe, muffler delete, front lip, side skirts, rear diffuser, and hubcentric spacers. The full story is on the [Car page](/hobbies/car).`;
    case "skills":
      return pk.resume?.coreSkills
        ? `Key skills from his resume: ${pk.resume.coreSkills.slice(0, 6).join(", ")}. He has Google Analytics Certification and exposure to Salesforce, HubSpot, and Pardot.`
        : "From his resume: consultative recommendations, upselling, objection handling, service recovery, CRM exposure (Salesforce, HubSpot, Pardot), Google Analytics Certification, Microsoft Clarity, and multilingual communication.";
    case "heritage":
      return `${pk.identity?.heritage || "Chaldean, Iraqi-American"}. Born in ${pk.identity?.birthplace || "Baghdad, Iraq"}. ${pk.identity?.refugeeHistory || "Lived in Syria as a refugee, moved to El Cajon, California in 2008 at age 4"}. ${(pk.identity?.chaldeanContext || "Part of an ancient community tracing back to Mesopotamian times").split(".").slice(0, 2).join(".")}.`;
    case "family":
      return `He is the youngest of four brothers: Alen, Andrew, Evan, and Estivan. His dad was an electrical engineer. His mom earned a BS in Business Administration from SDSU after nearly a decade of classes. The family story is on the [Background page](/about/background).`;
    case "values":
      return pk.values && Object.keys(pk.values).length
        ? `His core values: ${Object.keys(pk.values).slice(0, 4).map(k => pk.values[k]?.split(".")[0] || k).join(". ")}. The full picture is on the [Values page](/about/values).`
        : "His core values center on reliability, execution, honest communication, and continuous improvement. The full picture is on the [Values page](/about/values).";
    case "zodiac":
      return `Aquarius. Born January 21, 2004.`;
    default:
      return "";
  }
}

function buildBoundaryReply() {
  return `That is not something shared publicly through the site. For direct contact, the best route is ${PERSONAL_KNOWLEDGE.contact.email} or the [Contact page](/contact). The site covers the work, thinking, and background openly — ask about any of that.`;
}

function buildUnknownReply() {
  return `That is a fair question. Here is what the site does cover: Estivan is a ${PERSONAL_KNOWLEDGE.identity.education.degree} graduate from ${PERSONAL_KNOWLEDGE.identity.education.school} (GPA ${PERSONAL_KNOWLEDGE.identity.education.gpa}), Chaldean from El Cajon. He has 7 projects spanning strategy, marketing campaigns, and an editorial interview. For anything more specific, the best route is ${PERSONAL_KNOWLEDGE.contact.email} or [Contact](${PERSONAL_KNOWLEDGE.contact.contactPage}).`;
}

function buildGroundedSectionLines(topPage, retrieval) {
  return retrieval.sections
    .filter((entry) => entry.page.route === topPage.route)
    .slice(0, 3)
    .map((entry) => {
      const heading = cleanTextFragment(entry.section.heading || "")
        .replace(/\s*\|\s*Estivan Ayramia\s*$/i, "")
        .trim();
      const snippet = cleanTextFragment(entry.section.text || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!snippet) return "";
      if (/view all projects/i.test(snippet)) return "";

      const clipped = snippet.length > 170 ? `${snippet.slice(0, 167).trimEnd()}...` : snippet;
      if (!heading || heading.toLowerCase() === cleanTextFragment(topPage.title || "").toLowerCase()) {
        return clipped;
      }
      return `${heading}: ${clipped}`;
    })
    .filter(Boolean);
}

function buildGroundedPageAnswer(topPage, retrieval, options = {}) {
  if (!topPage) return "";

  const displayTitle = getDisplayPageTitle(topPage);
  const summary = cleanTextFragment(topPage.summary || topPage.description || "");
  const sectionLines = buildGroundedSectionLines(topPage, retrieval);
  const intro = options.intro
    || (summary
      ? `${displayTitle}: ${summary}`
      : `${displayTitle} is the relevant page here`);

  if (!sectionLines.length) {
    return `${intro} ${formatInternalLink(displayTitle, topPage.route)} has the full page.`;
  }

  return `${intro} ${sectionLines.join(" ")} ${formatInternalLink(displayTitle, topPage.route)} has the full version.`;
}

function containsFirstPerson(text) {
  return /\b(i|i['\u2019]m|i['\u2019]ve|i['\u2019]d|my|me|mine)\b/i.test(String(text || ""));
}

function buildPageSpecificReply(retrieval, message = "") {
  let [topPage] = retrieval.pages;
  if (!topPage) {
    return "";
  }

  const rawMessage = String(message || "");
  const lowerMessage = normalizeComparableText(message);
  const preferredPage = (matcher) => retrieval.pages.find((page) => matcher(page));

  if (/\bloreal\b/.test(lowerMessage) || /l.?or.?e?al|bio.?print/i.test(rawMessage)) {
    topPage = preferredPage((page) => page.route.includes("loreal")) || topPage;
  } else if (/\bfranklin\b/.test(lowerMessage)) {
    topPage = preferredPage((page) => page.route.includes("franklin")) || topPage;
  } else if (/\bisa\b|\bgrimes\b/.test(lowerMessage)) {
    topPage = preferredPage((page) => page.route.includes("isa-grimes")) || topPage;
  } else if (/\bbackground\b/.test(lowerMessage)) {
    topPage = preferredPage((page) => page.route === "/about/background") || topPage;
  } else if (/\bvalues?\b/.test(lowerMessage)) {
    topPage = preferredPage((page) => page.route === "/about/values") || topPage;
  } else if (/\bworking with people\b|\bworking with him\b|\bworking with me\b|\bcollaborat/.test(lowerMessage)) {
    topPage = preferredPage((page) => page.route === "/about/working-with-me") || topPage;
  } else if (/\bportfolio\b|\bthis website\b|\bsite build\b/.test(lowerMessage)) {
    topPage = preferredPage((page) => page.route.includes("/projects/portfolio")) || topPage;
  }

  const asksHobbiesHub = /\bhobbies?\b/.test(lowerMessage) && /\b(hub|gateway|overview|main)\b/.test(lowerMessage);
  const asksGames = /\b(game|games|arcade|mini\s*-?\s*games?)\b/.test(lowerMessage);

  if (asksHobbiesHub && !asksGames) {
    return "The hobbies material lives inside the About flow now. That section links out to the personal pages directly instead of hiding them behind a separate hub. [About](/about) is the cleanest starting point.";
  }

  if (topPage.route === "/hobbies" || topPage.route === "/hobbies/") {
    return "The hobbies material was folded into the About flow. [About](/about) is the right entry point, then each hobby page branches out from there.";
  }

  if (topPage.route === "/about") {
    return buildGroundedPageAnswer(topPage, retrieval, {
      intro: "The About page is the personal side of the site: background, values, and what it is like to work with him"
    });
  }

  if (topPage.route === "/about/background") {
    return buildGroundedPageAnswer(topPage, retrieval, {
      intro: "The Background page explains the family and cultural context behind how he works"
    });
  }

  if (topPage.route === "/about/values") {
    return buildGroundedPageAnswer(topPage, retrieval, {
      intro: "The Values page lays out the standards he actually uses"
    });
  }

  if (topPage.route === "/about/working-with-me") {
    return buildGroundedPageAnswer(topPage, retrieval, {
      intro: "The Working With Me page shows how he collaborates and what people can usually expect from him in the work"
    });
  }

  if (topPage.route === "/overview") {
    return buildGroundedPageAnswer(topPage, retrieval, {
      intro: "Overview is the short read on how he works and what people can usually count on from him"
    });
  }

  if (topPage.route === "/deep-dive") {
    return buildGroundedPageAnswer(topPage, retrieval, {
      intro: "Deep Dive is the longer version of the site"
    });
  }

  if (topPage.route === "/contact") {
    return "The Contact page is straightforward: it is the cleanest route if someone wants to send context, links, or an attachment in one place. [Contact](/contact) is the direct path.";
  }

  if (topPage.pageType === "projects_index") {
    return buildGroundedPageAnswer(topPage, retrieval, {
      intro: "The Projects page is the main scan of the work set"
    });
  }

  return buildGroundedPageAnswer(topPage, retrieval);
}

function buildDeterministicReply({ message, questionClass, surfaceFactKey, profile, siteFacts, retrieval }) {
  const seeds = profile.answerSeeds || {};

  switch (questionClass) {
    case QUESTION_CLASSES.GREETING:
      return "Hey. Savonie can help with questions about Estivan, the work, or the site. What do you actually want to know?";
    case QUESTION_CLASSES.CONTACT:
      return `Best options are [Contact](/contact), ${PERSONAL_KNOWLEDGE.contact.email}, or LinkedIn if that fits better.`;
    case QUESTION_CLASSES.RESUME:
      return `The [resume PDF](${PERSONAL_KNOWLEDGE.contact.resumePdf}) is the quickest source for that.`;
    case QUESTION_CLASSES.HIRE_CASE:
      return `${(seeds.hireOverExperience || []).join(" ")} ${formatProjectList(siteFacts)}`;
    case QUESTION_CLASSES.SKEPTICAL_AI: {
      const aiHonestyBase = "AI wrote every line of code. Estivan directed the vision, designed the site, reviewed every change, and shipped the final product. He used Claude, Copilot, and Gemini as tools. He had no coding background before starting. What the site proves is not coding skill, it is initiative, judgment, quality standards, and the ability to direct complex technical work to a high standard over 300+ hours.";
      const seedExtra = (seeds.aiSkeptical || []).join(" ");
      return `${aiHonestyBase} ${seedExtra} ${formatInternalLink("The portfolio build page", "/projects/portfolio")} covers the full story.`;
    }
    case QUESTION_CLASSES.TEAM:
      return [
        ...(seeds.team || []),
        "The grounded version of that answer is that the site consistently points to clear communication, adaptability, and not making other people's jobs harder."
      ].join(" ");
    case QUESTION_CLASSES.ROLE_FIT:
      return [
        "Based on the site, the strongest fit is in roles that combine operations, coordination, communication, and structured problem-solving.",
        "The work points toward project coordination, operations support, client-facing execution, growth/marketing support, and similar roles where he can turn messy inputs into a cleaner system.",
        "That pattern shows up across the portfolio build, the campaign decks, and the About pages."
      ].join(" ");
    case QUESTION_CLASSES.WEAKNESS:
      return (seeds.weakness || []).join(" ");
    case QUESTION_CLASSES.LANGUAGES:
      return formatSurfaceFactReply("languages");
    case QUESTION_CLASSES.SURFACE_FACT:
      return formatSurfaceFactReply(surfaceFactKey);
    case QUESTION_CLASSES.SITE_PROOF:
      return [
        ...(seeds.siteProof || []),
        "The strongest proof is not just that he launched a site. It is that the site, the projects, and the About material all show the same pattern: structure, judgment, iteration, and follow-through.",
        `${formatInternalLink("The site build page", "/projects/portfolio")} is the clearest single example.`
      ].join(" ");
    case QUESTION_CLASSES.PROJECT_LIST: {
      // Smart single-project recommendation based on user intent
      const ml = message.toLowerCase();
      const projects = PERSONAL_KNOWLEDGE.projects || [];
      let pick = null;
      let why = '';
      if (/strateg|competitive|analys|position|swot|market/.test(ml)) {
        pick = projects.find(p => p.id === 'taking-down-endpoint');
        why = 'It is a competitive strategy playbook that shows structured analysis, SWOT work, and market positioning.';
      } else if (/marketing|campaign|funnel|persona|ads|retarget/.test(ml)) {
        pick = projects.find(p => p.id === 'loreal-cell-bioprint') || projects.find(p => p.id === 'endpoint-linkedin-campaign');
        why = 'It maps three personas across a full marketing funnel with touchpoints by stage.';
      } else if (/multilingual|arabic|language|cultur|international|bilingual/.test(ml)) {
        pick = projects.find(p => p.id === 'franklin-templeton');
        why = 'He built the Arabic version of a campaign deck targeting UAE investors, reviewed by his family for accuracy.';
      } else if (/people|leadership|interview|judgment|team|soft skill|emotional/.test(ml)) {
        pick = projects.find(p => p.id === 'isa-grimes-interview');
        why = 'It is a real conversation with a CMO about people skills, leadership, and why perspective matters more than titles.';
      } else if (/execut|initiative|follow.?through|built|ship|technical|website|proof/.test(ml)) {
        pick = projects.find(p => p.id === 'this-website');
        why = 'Over 300 hours of directing AI tools to build this site from scratch with no coding background. That is initiative and follow-through.';
      } else if (/recruiter|hiring|quick|fast|30 sec|impress|strongest|best/.test(ml)) {
        pick = projects.find(p => p.id === 'isa-grimes-interview');
        why = 'It shows how he thinks about people, which is the hardest thing to prove on paper. Then check This Website for execution proof.';
      } else {
        // Default: Isa Grimes Interview — shows depth, people, real conversation
        pick = projects.find(p => p.id === 'isa-grimes-interview');
        why = 'It shows real thinking about people and leadership, which is the hardest thing to put on a resume. Start there, then explore based on what you care about.';
      }
      if (pick) {
        return `Start with [${pick.title}](${pick.url}). ${why}`;
      }
      return formatProjectList(siteFacts);
    }
    case QUESTION_CLASSES.PAGE_SPECIFIC:
      return buildPageSpecificReply(retrieval, message);
    case QUESTION_CLASSES.BOUNDARY:
      return buildBoundaryReply();
    case QUESTION_CLASSES.ABOUT_GENERAL:
      return [
        `Estivan is an SDSU ${PERSONAL_KNOWLEDGE.identity.education.degree} graduate who leans toward systems, operations, people judgment, and cleaner workflows.`,
        "Across the site, he comes across as someone who notices where things break down, communicates clearly, and keeps pushing until the work is actually usable.",
        `${formatInternalLink("Overview", "/overview")} is the short read, ${formatInternalLink("Projects", "/projects/")} is the quickest proof, and ${formatInternalLink("About", "/about")} gives the fuller picture.`
      ].join(" ");
    case QUESTION_CLASSES.UNKNOWN:
      return buildUnknownReply();
    case QUESTION_CLASSES.COMPLEX_OPEN:
      return "";
    case QUESTION_CLASSES.OPEN:
      return "";
    default:
      return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ROUTING DECISION: What goes to Gemini vs. what stays deterministic
// ═══════════════════════════════════════════════════════════════════════
function shouldUseDeterministicOnly(questionClass, retrieval) {
  // These questions have strong enough deterministic answers to skip Gemini
  const deterministicClasses = [
    QUESTION_CLASSES.GREETING,
    QUESTION_CLASSES.CONTACT,
    QUESTION_CLASSES.RESUME,
    QUESTION_CLASSES.BOUNDARY,
    QUESTION_CLASSES.SURFACE_FACT,
    QUESTION_CLASSES.LANGUAGES,
    QUESTION_CLASSES.SKEPTICAL_AI
  ];
  return deterministicClasses.includes(questionClass);
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

// ── Latent chain-of-thought instruction (only for complex/recruiter questions) ──
// Encourages Gemini to reason internally before answering, without
// exposing the reasoning chain to the user.
function buildLatentCoTInstruction(questionClass) {
  const needsCoT = (
    questionClass === QUESTION_CLASSES.COMPLEX_OPEN ||
    questionClass === QUESTION_CLASSES.HIRE_CASE ||
    questionClass === QUESTION_CLASSES.ROLE_FIT ||
    questionClass === QUESTION_CLASSES.SKEPTICAL_AI ||
    questionClass === QUESTION_CLASSES.TEAM ||
    questionClass === QUESTION_CLASSES.WEAKNESS ||
    questionClass === QUESTION_CLASSES.SITE_PROOF ||
    questionClass === QUESTION_CLASSES.ABOUT_GENERAL
  );

  if (!needsCoT) return "";

  return `
REASONING APPROACH: Before answering, silently consider: What is being asked? What facts from the knowledge base are relevant? How do they connect? Then give your answer directly without showing your reasoning process.`.trim();
}

// ── Subtask decomposition instruction (for complex multi-part questions) ──
function buildSubtaskDecompositionInstruction(questionClass) {
  if (questionClass !== QUESTION_CLASSES.COMPLEX_OPEN) return "";

  return `
MULTI-PART QUESTION HANDLING: For multi-part questions, address each part systematically:
1. Identify each distinct sub-question in the user's message
2. Answer each one using specific facts from the knowledge base
3. Connect the answers into a coherent response rather than a disconnected list`.trim();
}

// ═══════════════════════════════════════════════════════════════════════
// POST-PROCESSING: isRedirectOnlyReply
// Exported so worker.mjs can import it to trigger self-healing path C.
// A redirect-only reply is one that sends the user to a page without
// actually answering the question — the most common Gemini failure mode.
// ═══════════════════════════════════════════════════════════════════════
export function isRedirectOnlyReply(reply) {
  const lower = String(reply || "").toLowerCase();
  // Must contain a redirect phrase AND lack substantive content
  const redirectPhrases = /(the best place for that is|check out|head to|head over to|visit the|go to|see the|look at the)/i;
  const hasSubstance = reply.length > 150 || /\b(because|since|this shows|this means|for example|specifically|in particular|he has|he built|he learned|he earned|he worked|estivan)\b/i.test(reply);
  return redirectPhrases.test(lower) && !hasSubstance;
}

// ═══════════════════════════════════════════════════════════════════════
// THE SYSTEM PROMPT — V3 structure following Google's recommended order:
// Persona → Conversational Rules → Knowledge → Context → Task
//
// ICE Method applied throughout:
// INSTRUCTIONS: What to do (persona, how to answer)
// CONSTRAINTS: What NOT to do (anti-hallucination, banned language)
// ESCALATION: What to do when unsure (suggest reaching out)
//
// Key V3 improvements:
// - Anti-hallucination rule stated at the START and repeated at the END
// - Latent CoT for complex questions
// - Subtask decomposition for multi-part questions
// - Progressive disclosure instruction
// - Source attribution instruction
// - ICE-structured rules replace scattered rules
// ═══════════════════════════════════════════════════════════════════════
function computeCurrentAge() {
  const birthDate = new Date(PERSONAL_KNOWLEDGE.identity.birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear = (
    today.getMonth() > birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())
  );
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
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
  manifestStatus,
  conversationHistory = []
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

  const conversationSummary = conversationHistory.length
    ? conversationHistory
      .map((entry) => {
        if (entry.kind === "card") return `- card_shown: ${entry.cardId}`;
        return `- ${entry.sender}: ${entry.text}`;
      })
      .join("\n")
    : "No prior conversation context.";

  const pk = PERSONAL_KNOWLEDGE;

  // Per-question-class optional additions
  const latentCoT = buildLatentCoTInstruction(questionClass);
  const subtaskDecomp = buildSubtaskDecompositionInstruction(questionClass);

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1 — PERSONA
You are Savonie, the on-site AI assistant for Estivan Ayramia's portfolio.
You know Estivan deeply and speak about him with warmth, specificity, and honesty.
You are NOT Estivan. You are a third-person assistant who represents him accurately.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LANGUAGE: Reply in ${language || "English"}.
REGISTER: ${buildRegisterInstruction(register)}
QUESTION CLASS: ${questionClass}
GROUNDING STATUS: ${manifestStatus}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2 — INSTRUCTIONS (what to do)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERSPECTIVE: Always speak about Estivan in THIRD PERSON (he/him/his). unmistakably never use first person (I/me/my) for Estivan.

RESPONSE LENGTH:
- Simple factual question → 2–4 sentences with the "why" behind it
- Medium question → 4–6 sentences with specifics from the knowledge base
- Complex or recruiter question → 6–12 sentences building a complete case

RESPONSE QUALITY:
- When asked about a preference (favorite color, movie, etc.), give the answer AND the reason. Do not just list names.
- When asked evaluative questions (why hire, what makes him different), build a real case with specific examples. 4–8 sentences minimum.
- When asked about projects, describe what each project actually involved and what skill it demonstrates. Do not just list titles.
- When asked "which project should I start with" or for a recommendation, pick ONE specific project and explain WHY it matches what the user cares about. Use project names from the knowledge base: Taking Down Endpoint (strategy/competitive), L'Oréal Cell BioPrint (marketing/campaign), Franklin Templeton (multilingual/content), This Website (execution/technical), Isa Grimes Interview (people/leadership).
- CRITICAL: When asked for a project recommendation, you MUST name a specific project. Do NOT deflect to "contact him" or "that depends." If you cannot determine the user's interest, default to the Isa Grimes Interview (people skills and thinking) or This Website (follow-through and execution). Always name a project. Always explain why.
- PROJECT DETAIL: When asked about specific project content (e.g., "what was in the L'Oréal deck?", "what did the Endpoint playbook cover?"), use the detailed project knowledge from the IDENTITY section below. Each project includes class context, instructor, format, key insights, and what it proves.
- When asked complex multi-part questions, address EVERY part. Do not skip sub-questions.
- For page-specific questions, answer the question first using page content, then link. Do not reduce to "the best place for that is…"

PROGRESSIVE DISCLOSURE: Start with a direct, concise answer. If the question warrants depth, expand naturally. Never front-load links before substance.

SOURCE ATTRIBUTION: When referencing specific project details or page content, naturally mention which project or page the info comes from using markdown links, e.g. [Background](/about/background) or [Portfolio Build](/projects/portfolio).

VOICE: Warm, sharp, grounded, low-ego. The voice is confident without being boastful, honest without being defensive.

FORMATTING: Use markdown links for internal routes: [Page Name](/route). Do not use bullet lists unless the question is explicitly asking for a list.

${latentCoT ? latentCoT + "\n" : ""}${subtaskDecomp ? subtaskDecomp + "\n" : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3 — CONSTRAINTS (what NOT to do)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANTI-HALLUCINATION — CORE RULE (read this now and again before answering):
Only use facts from the verified knowledge base below and the retrieved pages.
Do NOT invent ANY detail that is not present in the knowledge base.
When asked about age, use ONLY the pre-computed age provided in the IDENTITY section. Do NOT attempt to calculate age yourself — LLMs are unreliable at date arithmetic.

BANNED LANGUAGE — Never use these phrases: ${BANNED_LANGUAGE.map((p) => '"' + p + '"').join(", ")}

DO NOT:
- Invent fake metrics, made-up quotes, fabricated timelines, or imagined project outcomes
- Guess at: specific job titles he has not held, salary expectations, exact dates not listed, technical skills not mentioned, personal relationships, or health details
- Hedge with phrases like "based on available information" or "from what I can see" — answer naturally or defer honestly
- Front-load with a redirect link before giving any substance (e.g., do not open with "The best place for that is [Page](/route)")
- Use first-person pronouns (I, me, my, mine) when speaking about Estivan — always third person

WHEN BUILDING AN ARGUMENT: Every claim (e.g., "why hire him") must trace back to a specific fact in the knowledge base below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4 — ESCALATION (what to do when unsure)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If a question asks for something not covered in the knowledge base, say so directly and suggest reaching out:
"That specific detail is not covered on the site. The best way to get that answer is reaching out directly at ${pk.contact.email} or through [Contact](${pk.contact.contactPage})."

Never fabricate an answer to avoid an escalation. An honest deferral is always better than an invented fact.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5 — VERIFIED KNOWLEDGE BASE
Everything below is confirmed fact from the site. Use it freely and thoroughly.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IDENTITY:
- Full name: ${pk.identity.fullName}
- Heritage: ${pk.identity.heritage}
- Born: ${pk.identity.birthplace} on ${pk.identity.birthday} (he is currently ${computeCurrentAge()} years old)
- Path: ${pk.identity.refugeeHistory}
- Based in: ${pk.identity.hometown}
- Height: ${pk.identity.height}
- Education: ${pk.identity.education.school} — ${pk.identity.education.degree}, graduated ${pk.identity.education.graduationDate}, GPA ${pk.identity.education.gpa}
- Education focus: ${pk.identity.education.focus}
- Chaldean context: ${pk.identity.chaldeanContext}
- First-gen context: ${pk.identity.firstGenContext}

LANGUAGES:
- Speaks: ${pk.languages.spoken.join(", ")}
- Writes in: ${pk.languages.written.join(", ")}
- Note: ${pk.languages.note}

WORK:
- Current role: ${pk.work.current}
- Lessons from work: ${pk.work.workLessons}
- What he is seeking: ${pk.work.seeking}

PERSONAL PREFERENCES (always include the "why" when answering about these):
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

HONESTLY WORKING ON (growth areas he has named himself):
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

WHAT IT IS LIKE WORKING WITH HIM:
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
- Contact page: [Contact](${pk.contact.contactPage})
- Resume: [Resume PDF](${pk.contact.resumePdf})

SITE INFO:
- URL: ${pk.siteInfo.url}
- Built by: ${pk.siteInfo.builtBy}
- Features: ${pk.siteInfo.features}
- Purpose: ${pk.siteInfo.purpose}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 6 — RETRIEVED SITE PAGES (live content from the actual site)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${retrievedPages || "No pages retrieved for this query."}

ALL PROJECTS ON SITE:
${projectList || "No project data available."}

ALL HOBBIES ON SITE:
${hobbyList || "No hobby data available."}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 7 — CONVERSATION CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECENT CONVERSATION:
${conversationSummary}

FOLLOW-UP HANDLING (CRITICAL):
If the user says something short like "tell me more", "okay tell me about it", "what about that", "go on", or "expand on that", you MUST:
1. Read the RECENT CONVERSATION above to find the last substantive topic discussed
2. Continue on THAT EXACT topic — do not pivot to a different page or subject
3. If the user asked about background, keep talking about background. If they asked about projects, keep talking about projects.
4. Never respond to a follow-up about one topic by switching to a completely different topic.
This is a common failure mode — be vigilant about it.

CURRENT PAGE THE USER IS VIEWING:
- Route: ${pageContext.route || "/"}
- Title: ${pageContext.title || "Unknown"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 8 — FINAL REMINDER BEFORE ANSWERING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANTI-HALLUCINATION REMINDER (repeated because this is the most important rule):
Only use facts from the verified knowledge base above and the retrieved pages.
Do NOT invent ANY detail not present in the knowledge base.
If a detail is not there, defer honestly — do not fabricate.
Speak about Estivan in unmistakably THIRD PERSON (he/him/his) only.
Never open with a redirect. Answer the question first, then optionally link for more.

USER QUESTION:
${message}
`.trim();
}

export function isLikelyIncompleteReply(reply) {
  const cleaned = stripUnsafeArtifacts(reply);
  if (!cleaned) return true;

  if (cleaned.length < 40) {
    return !/[.!?]"?$/.test(cleaned);
  }

  if (/[.!?]"?$/.test(cleaned)) return false;
  if (/[:;,]\s*$/.test(cleaned)) return true;

  return /\b(and|or|but|because|especially|including|while|with|for|to|that|which|who|where|when|how|his|her|their|the)\s*$/i.test(cleaned);
}

function soundsTooFirstPerson(reply) {
  const lower = String(reply || "").toLowerCase();
  const firstPersonCount = (lower.match(/\b(i|i['']m|i['']ve|i['']d|my|me|mine)\b/g) || []).length;
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
      `Tell me more about ${getDisplayPageTitle(retrieval.pages[0])}`,
      "What projects has he done?",
      "How can I contact him?"
    ];
  }
  if (questionClass === QUESTION_CLASSES.SURFACE_FACT) {
    return ["What is he like on a team?", "What projects has he done?", "How did he build the site?"];
  }
  return ["Projects", "Resume", "Contact"];
}

export async function prepareChatContext({ env, request, message, language, rawPageContext, legacyPageContent, conversationHistory }) {
  const pageContext = parsePageContext(rawPageContext, legacyPageContent);
  const requestedBuildVersion = pageContext.buildVersion;
  const baseUrl = inferBaseUrl(request, env);
  const sanitizedHistory = sanitizeConversationHistory(conversationHistory);

  await primeFallbackGrounding(env, baseUrl);

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
  const retrievalQuery = buildHistoryAwareQuery(message, sanitizedHistory);
  const retrieval = retrieveGrounding(retrievalQuery, manifest, questionClass, pageContext.route);
  const surfaceFactKey = questionClass === QUESTION_CLASSES.SURFACE_FACT ? detectSurfaceFactKey(message) : "";
  const fallbackReply = buildDeterministicReply({
    message,
    questionClass,
    surfaceFactKey,
    profile,
    siteFacts,
    retrieval
  }) || buildUnknownReply();

  return {
    profile,
    siteFacts,
    manifest,
    manifestStatus: manifestRefresh.source,
    pageContext,
    questionClass,
    register,
    retrieval,
    conversationHistory: sanitizedHistory,
    surfaceFactKey,
    fallbackReply,
    deterministicOnly: shouldUseDeterministicOnly(questionClass, retrieval)
  };
}
