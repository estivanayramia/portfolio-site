const ENTITY_MAP = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&#39;": "'",
  "&nbsp;": " "
};

const MOJIBAKE_MAP = {
  "\u00c3\u00a9": "\u00e9",
  "\u00c3\u00a1": "\u00e1",
  "\u00c3\u00a8": "\u00e8",
  "\u00c3\u00b3": "\u00f3",
  "\u00c3\u00ba": "\u00fa",
  "\u00c3\u00b1": "\u00f1",
  "\u00c3\u00bc": "\u00fc",
  "\u00e2\u20ac\u201c": "-",
  "\u00e2\u20ac\u201d": "-",
  "\u00e2\u20ac\u02dc": "'",
  "\u00e2\u20ac\u2122": "'",
  "\u00e2\u20ac\u0153": "\"",
  "\u00e2\u20ac\u009d": "\"",
  "\u00c2\u00a9": "\u00a9",
  "\u00c2 ": " ",
  "\u00c2": ""
};

const STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "for",
  "from",
  "has",
  "have",
  "he",
  "her",
  "here",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "she",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
  "your"
]);

const CONTENT_TAG_RE = /<(h[1-4]|p|li|summary|figcaption|blockquote|td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
const TAG_RE = /<[^>]+>/g;

function safeLower(text) {
  return String(text || "").toLowerCase();
}

export function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function decodeHtmlEntities(text) {
  let output = String(text || "");

  for (const [entity, replacement] of Object.entries(ENTITY_MAP)) {
    output = output.split(entity).join(replacement);
  }

  output = output.replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    try {
      return String.fromCodePoint(Number.parseInt(hex, 16));
    } catch {
      return "";
    }
  });

  output = output.replace(/&#(\d+);/g, (_, value) => {
    try {
      return String.fromCodePoint(Number.parseInt(value, 10));
    } catch {
      return "";
    }
  });

  return output;
}

export function repairMojibake(text) {
  let output = String(text || "");
  for (const [bad, good] of Object.entries(MOJIBAKE_MAP)) {
    output = output.split(bad).join(good);
  }
  return output;
}

export function cleanTextFragment(text) {
  return normalizeWhitespace(
    repairMojibake(decodeHtmlEntities(String(text || "")))
      .replace(TAG_RE, " ")
      .replace(/[|]{2,}/g, " ")
      .replace(/[ ]{2,}/g, " ")
  );
}

export function normalizeRoute(input) {
  const raw = String(input || "").trim();
  if (!raw) return "/";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      return normalizeRoute(new URL(raw).pathname);
    } catch {
      return "/";
    }
  }

  if (raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) {
    return "";
  }

  let route = raw;
  const queryIndex = route.indexOf("?");
  if (queryIndex >= 0) route = route.slice(0, queryIndex);
  const hashIndex = route.indexOf("#");
  if (hashIndex >= 0) route = route.slice(0, hashIndex);

  route = route.replace(/\\/g, "/");
  if (!route.startsWith("/")) route = `/${route}`;

  if (route.endsWith("index.html")) {
    route = route.slice(0, -10) || "/";
  } else if (route.endsWith(".html")) {
    route = route.slice(0, -5);
  }

  route = route.replace(/\/{2,}/g, "/");

  if (route !== "/" && route.endsWith("/") && !route.startsWith("/projects/") && !route.startsWith("/hobbies/") && !route.startsWith("/about/")) {
    route = route.slice(0, -1);
  }

  if (route === "/projects" || route === "/hobbies" || route === "/ar" || route === "/es") {
    route = `${route}/`;
  }

  return route || "/";
}

export function isRelevantInternalRoute(route) {
  const normalized = normalizeRoute(route);
  if (!normalized) return false;
  if (normalized.startsWith("/assets/")) return false;
  if (normalized.startsWith("/api/")) return false;
  if (normalized.startsWith("/functions/")) return false;
  if (normalized.startsWith("/docs/")) return false;
  if (normalized.startsWith("/worker/")) return false;
  if (normalized.startsWith("/hobbies-games")) return false;
  if (/\.(pdf|png|jpe?g|webp|gif|svg|ico|css|js|json|xml|txt)$/i.test(normalized)) return false;
  return true;
}

export function classifyPageType(route) {
  const normalized = normalizeRoute(route);
  if (normalized === "/") return "home";
  if (normalized === "/overview") return "overview";
  if (normalized === "/deep-dive") return "deep_dive";
  if (normalized === "/about") return "about";
  if (normalized.startsWith("/about/")) return "about_detail";
  if (normalized === "/projects/") return "projects_index";
  if (normalized.startsWith("/projects/")) return "project_detail";
  if (normalized === "/hobbies/") return "hobbies_index";
  if (normalized.startsWith("/hobbies/")) return "hobby_detail";
  if (normalized === "/contact") return "contact";
  if (normalized.startsWith("/es")) return "spanish";
  if (normalized.startsWith("/ar")) return "arabic";
  return "page";
}

export function detectLanguage(route, html) {
  const routeValue = normalizeRoute(route);
  if (routeValue.startsWith("/es")) return "es";
  if (routeValue.startsWith("/ar")) return "ar";
  const langMatch = String(html || "").match(/<html[^>]*lang=["']([^"']+)["']/i);
  if (langMatch) {
    const lang = safeLower(langMatch[1]).split("-")[0];
    if (lang) return lang;
  }
  return "en";
}

export function extractMetaContent(html, attribute, value) {
  const pattern = new RegExp(
    `<meta[^>]*${attribute}=["']${value}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i"
  );
  const match = String(html || "").match(pattern);
  return cleanTextFragment(match ? match[1] : "");
}

export function extractTitle(html) {
  const match = String(html || "").match(/<title>([\s\S]*?)<\/title>/i);
  return cleanTextFragment(match ? match[1] : "");
}

export function extractCanonicalPath(html) {
  const match = String(html || "").match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  if (!match) return "";
  return normalizeRoute(match[1]);
}

export function extractBuildVersion(html) {
  const match = String(html || "").match(/<meta[^>]*name=["']build-version["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  return cleanTextFragment(match ? match[1] : "");
}

export function extractMainHtml(html) {
  const source = String(html || "");
  const mainMatch = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const bodyMatch = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return mainMatch ? mainMatch[1] : (bodyMatch ? bodyMatch[1] : source);
}

function stripNoisyMarkup(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<button[\s\S]*?<\/button>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function shouldKeepText(text) {
  const value = normalizeWhitespace(text);
  if (!value) return false;
  if (value.length < 3) return false;
  if (/^(projects|overview|deep dive|about|contact|home)$/i.test(value)) return false;
  if (/^(skip to main content|toggle mobile menu|switch to light mode|switch to dark mode)$/i.test(value)) return false;
  return true;
}

export function extractInternalLinks(html) {
  const source = extractMainHtml(html);
  const links = new Set();
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match = anchorRe.exec(source);

  while (match) {
    const route = normalizeRoute(match[1]);
    if (route && isRelevantInternalRoute(route)) {
      links.add(route);
    }
    match = anchorRe.exec(source);
  }

  return [...links];
}

export function tokenizeText(text) {
  return [...new Set(
    safeLower(text)
      .replace(/[^a-z0-9\s/+-]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
  )];
}

export function createChecksum(text) {
  let hash = 2166136261;
  const input = String(text || "");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

export function extractSectionsFromHtml(html, fallbackHeading = "Overview") {
  const main = stripNoisyMarkup(extractMainHtml(html));
  const sections = [];
  let current = {
    heading: fallbackHeading,
    level: 1,
    textParts: []
  };

  CONTENT_TAG_RE.lastIndex = 0;
  let match = CONTENT_TAG_RE.exec(main);
  while (match) {
    const tag = safeLower(match[1]);
    const text = cleanTextFragment(match[2]);
    if (!shouldKeepText(text)) {
      match = CONTENT_TAG_RE.exec(main);
      continue;
    }

    if (tag.startsWith("h")) {
      if (current.textParts.length) {
        sections.push({
          heading: current.heading,
          level: current.level,
          text: normalizeWhitespace(current.textParts.join("\n"))
        });
      }

      current = {
        heading: text,
        level: Number.parseInt(tag.slice(1), 10) || 2,
        textParts: []
      };
    } else {
      current.textParts.push(text);
    }

    match = CONTENT_TAG_RE.exec(main);
  }

  if (current.textParts.length) {
    sections.push({
      heading: current.heading,
      level: current.level,
      text: normalizeWhitespace(current.textParts.join("\n"))
    });
  }

  return sections
    .map((section) => ({
      ...section,
      keywords: tokenizeText(`${section.heading} ${section.text}`).slice(0, 24)
    }))
    .filter((section) => shouldKeepText(section.text));
}

export function createSummary(sections, description) {
  if (description) return description;
  if (!sections.length) return "";
  const intro = sections[0].text || "";
  if (intro.length <= 240) return intro;
  const clipped = intro.slice(0, 237);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 0 ? lastSpace : clipped.length)}...`;
}

export function createPageRecord({ route, html, sourceFile }) {
  const normalizedRoute = normalizeRoute(route);
  const title = extractTitle(html);
  const description = extractMetaContent(html, "name", "description");
  const sections = extractSectionsFromHtml(html, title || normalizedRoute || "Overview");
  const summary = createSummary(sections, description);
  const language = detectLanguage(normalizedRoute, html);
  const headings = sections.map((section) => section.heading).filter(Boolean);
  const bodyText = sections.map((section) => `${section.heading}\n${section.text}`).join("\n\n");

  return {
    route: normalizedRoute,
    canonical: extractCanonicalPath(html) || normalizedRoute,
    sourceFile,
    language,
    pageType: classifyPageType(normalizedRoute),
    title,
    description,
    buildVersion: extractBuildVersion(html),
    summary,
    headings,
    links: extractInternalLinks(html),
    checksum: createChecksum(bodyText || html),
    keywords: tokenizeText(`${normalizedRoute} ${title} ${description} ${headings.join(" ")} ${summary}`).slice(0, 40),
    sections: sections.map((section) => ({
      heading: section.heading,
      level: section.level,
      text: section.text,
      keywords: section.keywords
    }))
  };
}

export function containsAny(text, values) {
  const lower = safeLower(text);
  return values.some((value) => lower.includes(safeLower(value)));
}
