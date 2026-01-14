// ============================================================================
// SAVONIE AI - ESTIVAN'S PORTFOLIO CHATBOT
// Cloudflare Worker with Rate Limiting, Smart Signals, & Auto-Healing
// ============================================================================

// Site facts - single source of truth for projects and hobbies
// Generated from HTML content by scripts/generate-site-facts.js
const siteFacts = {
  "projects": [
    {
      "title": "This Website (Every Line)",
      "summary": "No templates, no CMS. Just hand-written HTML/CSS/JS, service worker, Savonie chat, and Lighthouse 90+ scores.",
      "url": "https://www.estivanayramia.com/projects/portfolio.html",
      "path": "/projects/portfolio.html"
    },
    {
      "title": "L'Oréal Cell BioPrint MAPS Campaign",
      "summary": "Class concept campaign deck for L'Oréal Cell BioPrint that maps three personas and their touchpoints across the funnel.",
      "url": "https://www.estivanayramia.com/projects/logistics.html",
      "path": "/projects/logistics.html"
    },
    {
      "title": "Franklin Templeton Class Concept",
      "summary": "17-page class concept deck for a Franklin Templeton 'Voice of Progress' campaign.",
      "url": "https://www.estivanayramia.com/projects/discipline.html",
      "path": "/projects/discipline.html"
    },
    {
      "title": "EndPoint LinkedIn Campaign",
      "summary": "15-page deck outlining Phase 2A and Phase 2B of an EndPoint LinkedIn retargeting campaign.",
      "url": "https://www.estivanayramia.com/projects/documentation.html",
      "path": "/projects/documentation.html"
    },
    {
      "title": "Endpoint Elosity Launch Video",
      "summary": "Motion storyboard and full voiceover script showing bottlenecks shattering into a clean trial timeline.",
      "url": "https://www.estivanayramia.com/projects/multilingual.html",
      "path": "/projects/multilingual.html"
    },
    {
      "title": "Taking Down Endpoint (Almac Group + 4G Clinical)",
      "summary": "Marketing strategy deck proposing how Almac Group and 4G Clinical could position together against Endpoint Clinical.",
      "url": "https://www.estivanayramia.com/projects/competitive-strategy.html",
      "path": "/projects/competitive-strategy.html"
    }
  ],
  "hobbies": [
    {
      "title": "Gym & Strength Training",
      "summary": "Building discipline through progressive overload. Tracking PRs, optimizing recovery, and proving that consistency beats intensity every time.",
      "url": "https://www.estivanayramia.com/hobbies/gym.html",
      "path": "/hobbies/gym.html"
    },
    {
      "title": "Photography",
      "summary": "Capturing moments worth remembering. iPhone shots that tell stories; no DSLR needed, just good lighting and better timing.",
      "url": "https://www.estivanayramia.com/hobbies/photography.html",
      "path": "/hobbies/photography.html"
    },
    {
      "title": "Car Enthusiasm",
      "summary": "First car, first freedom. Not about speed; about ownership, maintenance, and the pride of keeping something running clean.",
      "url": "https://www.estivanayramia.com/hobbies/car.html",
      "path": "/hobbies/car.html"
    },
    {
      "title": "Cooking",
      "summary": "Steak, pasta, and everything in between. Not a chef; just someone who refuses to eat mediocre food when good ingredients are available.",
      "url": "https://www.estivanayramia.com/hobbies/cooking.html",
      "path": "/hobbies/cooking.html"
    },
    {
      "title": "Whispers (Sticky Notes)",
      "summary": "Random thoughts captured on sticky notes. Ideas, observations, reminders. Low-tech brain dump that keeps the mental clutter organized.",
      "url": "https://www.estivanayramia.com/hobbies/whispers.html",
      "path": "/hobbies/whispers.html"
    },
    {
      "title": "Reading",
      "summary": "Books are compressed experience. Reading is the cheapest way to access decades of wisdom without making the same mistakes yourself.",
      "url": "https://www.estivanayramia.com/hobbies/reading.html",
      "path": "/hobbies/reading.html"
    }
  ]
};

let cachedModel = "gemini-2.5-flash";
const GEMINI_TIMEOUT = 35000; // Increased to account for larger tokens/retries
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REPLY_CHARS = 8000; // Increased from 3000
const VERSION_TAG = "v2026.01.13-site-facts";

// Optional local rate limiter (fallback if env.RATE_LIMITER not configured)
const localRateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60000; // 60 seconds
const RATE_LIMIT_MAX = 20;

/**
 * Strip any JSON object blocks from text
 */
function stripJsonBlobs(text) {
  if (typeof text !== "string" || !text) return "";
  
  // Find first occurrence of JSON-like pattern with common keys
  const jsonStart = text.search(/\n?\s*\{\s*"(reply|chips|action|card|errorType)"/);
  if (jsonStart !== -1) {
    return text.substring(0, jsonStart).trim();
  }
  
  // Remove any trailing ```json block
  text = text.replace(/```json[\s\S]*?```$/i, "").trim();

  // Also check for standalone { at line start which looks like a JSON object beginning
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '{' || (line.startsWith('{') && line.includes('"'))) {
      // If it looks like the start of a JSON block, cut everything from here
      return lines.slice(0, i).join('\n').trim();
    }
  }
  
  return text.trim();
}

/**
 * Truncate text safely at a sentence boundary
 */
function safeTruncate(text, limit) {
  if (!text || text.length <= limit) return text;

  // Take the substring up to the limit
  const sub = text.slice(0, limit);

  // Look for the last sentence ending punctuation (. ? !)
  // We look in the last 100 characters to avoid cutting too much content
  const searchWindow = 100; // Search in the last 100 chars
  const startSearch = Math.max(0, limit - searchWindow);
  const tail = sub.slice(startSearch);
  
  // Find last punctuation
  const lastPunct = Math.max(
    tail.lastIndexOf('.'), 
    tail.lastIndexOf('!'), 
    tail.lastIndexOf('?')
  );

  if (lastPunct !== -1) {
    // Cut at punctuation + 1 (to include it)
    return sub.slice(0, startSearch + lastPunct + 1);
  }

  // Fallback: Try to cut at the last space
  const lastSpace = tail.lastIndexOf(' ');
  if (lastSpace !== -1) {
    return sub.slice(0, startSearch + lastSpace) + "...";
  }

  // Worst case: hard chop
  // Ensure we stay within limit
  return sub.slice(0, Math.max(0, limit - 3)) + "...";
}

/**
 * Auto-linkify key pages if they are not already linked
 */
function linkifyPages(text) {
  if (!text) return "";
  
  // Helper to replace word if not inside [link](url)
  // We use a simplified approach: just strict replacements if the exact case-insensitive plain word exists.
  // Note: This is best-effort. The prompt instructions are the primary defense.
  
  const map = [
    { word: "Overview", link: "[Overview](/overview.html)" },
    { word: "Projects", link: "[Projects](/projects/)" },  // Fixed: canonical URL
    { word: "Hobbies", link: "[Hobbies](/hobbies/)" },    // Fixed: canonical URL
    { word: "Contact", link: "[Contact](/contact.html)" },
    { word: "Resume", link: "[Resume](/assets/docs/Estivan-Ayramia-Resume.pdf)" }
  ];

  let linked = text;
  
  map.forEach(({ word, link }) => {
     // Regex checks for word boundary, case insensitive, but NOT preceded by [ and NOT followed by ]
     // This prevents double linking: [Overview](/overview.html) won't become [[Overview](/overview.html)](...)
     const regex = new RegExp(`(?<!\\[)\\b${word}\\b(?!\\])`, 'gi');
     linked = linked.replace(regex, link);
  });
  
  return linked;
}

/**
 * Detect user intent from message
 */
function detectIntent(lowerMsg) {
  if (/(^|\b)(hi|hello|hey|yo|good morning|good afternoon|good evening)(\b|!|\.)/.test(lowerMsg)) return "greeting";
  if (/(recruiter|hiring manager|interview|role|position|opportunity|availability|available|start date)/.test(lowerMsg)) return "recruiter";
  if (/(email|contact|reach|message|connect)/.test(lowerMsg)) return "contact";
  if (/(salary|compensation|rate|pay|wage|range)/.test(lowerMsg)) return "salary";
  if (/(project|projects|case study|portfolio|work samples)/.test(lowerMsg)) return "projects";
  // Detect "What does Estivan do?" and similar summary questions
  if (/(what does (he|estivan) do|what is (he|estivan)|who is (he|estivan)|who are you|about you|about estivan|summary|tell me about|elevator pitch|quick summary|bio|background|experience|his background)/.test(lowerMsg)) return "summary";
  // Detect skills-related questions
  if (/(skill|skills|what are (his|your) skills|technical|technology|technologies|tech stack|expertise|proficiency|what can (he|you) do|capabilities)/.test(lowerMsg)) return "skills";
  // Detect hobbies - IMPORTANT: whispers is a hobby (sticky notes), not a project
  if (/(hobbies|hobby|gym|workout|fitness|car|cars|reading|books|cooking|photography|whispers|sticky notes)/.test(lowerMsg)) return "hobbies";
  return "default";
}

/**
 * Get deterministic chips based on user intent
 * Returns ONLY dynamic contextual chips - Frontend adds pinned chips (Projects, Resume, Contact)
 * Uses site-facts as the authoritative source for projects and hobbies
 */
function buildChips(lowerMsg) {
  const intent = detectIntent(lowerMsg);
  
  // Return 3-5 contextual suggestions per intent
  // Do NOT include pinned chips here - frontend handles those
  
  switch (intent) {
    case "greeting":
      return ["What does Estivan do?", "Show me top skills", "View best projects"];
    
    case "summary":
      return ["What are his key skills?", "Recent work experience", "Top projects", "Education background"];
    
    case "skills":
      return ["What's his tech stack?", "Operations experience", "Any certifications?", "Programming languages", "Tools and frameworks"];
    
    case "projects":
      // Use first 4 projects from site-facts (the authoritative source)
      return siteFacts.projects.slice(0, 4).map(p => p.title);
    
    case "recruiter":
      return ["When can you start?", "Preferred work location?", "Salary expectations?", "Open to relocation?"];
    
    case "contact":
      return ["Email address", "LinkedIn profile", "Best time to reach out?"];
    
    case "salary":
      return ["What's your experience level?", "Recent projects impact", "Skills and expertise", "Career goals"];
    
    case "hobbies":
      // Use first 4 hobbies from site-facts (the authoritative source)
      return siteFacts.hobbies.slice(0, 4).map(h => h.title);
    
    default:
      return ["What does Estivan do?", "Key skills overview", "Top projects showcase"];
  }
}

/**
 * Build debug info for response (when debug mode is enabled)
 */
function buildDebugInfo(isDebug, lowerMsg, source = "buildChips") {
  if (!isDebug) return undefined;
  
  const intent = detectIntent(lowerMsg);
  return {
    intent: intent,
    chips_source: source,
    message_lower: lowerMsg.slice(0, 100)
  };
}

/**
 * Guardrail validation - prevent hallucinated projects
 * Validates that any project mentioned exists in site-facts
 */
function validateProjectMentions(text) {
  if (!text) return { isValid: true, violations: [] };
  
  // Check for specific fake projects we know about
  const knownFakeProjects = [
    "getwispers",
    "get wispers", 
    "whispers app",
    "whispers application",
    "messaging app",
    "discipline system"
  ];
  
  const lowerText = text.toLowerCase();
  const violations = [];
  
  // Check for fake projects
  for (const fake of knownFakeProjects) {
    if (lowerText.includes(fake)) {
      violations.push(fake);
    }
  }
  
  // If violations found, return invalid
  if (violations.length > 0) {
    return {
      isValid: false,
      violations: violations,
      correctedReply: `That project is not listed on the portfolio site. Check out [Projects](/projects/) to see Estivan's actual work, or reach out at [Contact](/contact.html) for more information.`
    };
  }
  
  return { isValid: true, violations: [] };
}

/**
 * Check if message is a greeting
 */
function isGreeting(lowerMsg) {
  return detectIntent(lowerMsg) === "greeting";
}

/**
 * Get CORS headers with origin validation
 */
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");
  
  // Production origins
  const allowedOrigins = [
    "https://estivanayramia.com",
    "https://www.estivanayramia.com"
  ];
  
  // Allow all localhost and 127.0.0.1 origins for development (any port)
  const isLocalhost = origin && (
    origin.startsWith("http://localhost:") || 
    origin.startsWith("http://127.0.0.1:")
  );
  
  const allowedOrigin = (allowedOrigins.includes(origin) || isLocalhost) 
    ? origin 
    : allowedOrigins[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

/**
 * Send consistent JSON responses
 */
function jsonReply(body, status, corsHeaders) {
  // Inject version for debugging
  const enhancedBody = { ...body, version: VERSION_TAG };
  return new Response(JSON.stringify(enhancedBody), {
    status,
    headers: { 
      ...corsHeaders, 
      "Content-Type": "application/json",
      "X-Savonie-Version": VERSION_TAG
    }
  });
}

/**
 * Fetch with timeout protection
 */
async function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// Retry Gemini calls with exponential backoff + jitter for transient upstream failures.
// Logs lengths and flags only, never user content.
async function callGeminiWithRetry(modelName, context, userMessage, apiKey, maxTokens, meta) {
  const first = await callGemini(modelName, context, userMessage, apiKey, maxTokens);
  if (!first?.error) return first;

  const code = Number(first.error.code || 0);
  // Only retry on transient errors (429, 500, 502, 503, 504)
  // Do NOT retry on 401, 403, 400
  const retryable = code === 429 || code === 500 || code === 502 || code === 503 || code === 504;

  console.log("Gemini retry check", {
    model: modelName,
    maxTokens,
    msgLen: meta?.msgLen ?? null,
    code,
    retryable
  });

  if (!retryable) return first;

  // Exponential backoff with jitter: 300ms, 900ms, 1800ms
  const delays = [300, 900, 1800];
  for (let i = 0; i < delays.length; i++) {
    const jitter = Math.random() * 100; // Add up to 100ms jitter
    await new Promise((r) => setTimeout(r, delays[i] + jitter));
    
    console.log(`Retry attempt ${i + 1} after ${delays[i]}ms`);
    const retryResult = await callGemini(modelName, context, userMessage, apiKey, maxTokens);
    
    if (!retryResult?.error) {
      console.log(`Retry ${i + 1} succeeded`);
      return retryResult;
    }
    
    console.log(`Retry ${i + 1} failed with code ${retryResult.error.code}`);
    // If still error, continue to next delay
  }

  console.log("All retries exhausted, returning original error");
  return first; // Return original error if all retries failed
}

/**
 * Local rate limiter (fallback when Cloudflare binding unavailable)
 */
function checkLocalRateLimit(clientIP) {
  const key = `ip:${clientIP}`;
  const now = Date.now();
  const record = localRateLimiter.get(key);
  
  if (!record) {
    localRateLimiter.set(key, { count: 1, startTime: now });
    return true;
  }
  
  // Reset window if expired
  if (now - record.startTime > RATE_LIMIT_WINDOW) {
    localRateLimiter.set(key, { count: 1, startTime: now });
    return true;
  }
  
  // Increment counter
  record.count++;
  
  if (record.count > RATE_LIMIT_MAX) {
    return false;
  }
  
  return true;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request);

    // --- CORS PREFLIGHT ---
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- HEALTH CHECK ---
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      const hasKey = !!(env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 10);
      return jsonReply(
        { ok: true, version: VERSION_TAG, hasKey },
        200,
        corsHeaders
      );
    }

    if (request.method !== "POST") {
      return jsonReply(
        { errorType: "BadRequest", reply: "Method not allowed." },
        405,
        corsHeaders
      );
    }

    try {
      // --- PARSE & VALIDATE REQUEST ---
      let body;
      try {
        body = await request.json();
      } catch (e) {
        console.error("Invalid JSON:", e.message);
        return jsonReply(
          { errorType: "BadRequest", reply: "Invalid JSON body." },
          400,
          corsHeaders
        );
      }

      const { message, pageContent, language, previousContext } = body || {};

      // Check for debug mode
      const url = new URL(request.url);
      const isDebug = url.searchParams.get('debug') === '1' || request.headers.get('X-Savonie-Debug') === '1';

      if (typeof message !== "string" || !message.trim()) {
        return jsonReply(
          { errorType: "BadRequest", reply: "Missing or empty 'message'." },
          400,
          corsHeaders
        );
      }

      // Sanitize message
      const userMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);
      const lowerMsg = userMessage.toLowerCase();

      // If continuation context is provided, inject it for the model only.
      // Keep lowerMsg based on the user's actual message for intent and chip logic.
      let sanitizedMessage = userMessage;
      if (previousContext && typeof previousContext === 'string') {
        const tail = previousContext.slice(0, 1000); // Limit context size
        sanitizedMessage = `(PREVIOUS REPLY ENDED WITH: "...${tail}")\n\nUSER ASKS: ${userMessage}`;
      }
      const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

      // --- RATE LIMITING ---
      if (env.RATE_LIMITER) {
        // Use Cloudflare Rate Limiting (preferred)
        try {
          const { success } = await env.RATE_LIMITER.limit({ key: `ip:${clientIP}` });
          
          if (!success) {
            return jsonReply(
              {
                errorType: "RateLimit",
                reply: "Whoa, too fast! Give me a minute to catch up. ⏱️",
                chips: ["Wait a moment", "What can you help with?"]
              },
              429,
              corsHeaders
            );
          }
        } catch (err) {
          console.error("Rate limiter error:", err);
          // Fall through to local fallback
        }
      } else {
        // Fallback: local in-memory rate limiting
        if (!checkLocalRateLimit(clientIP)) {
          return jsonReply(
            {
              errorType: "RateLimit",
              reply: "Whoa, too fast! Give me a minute to catch up. ⏱️",
              chips: ["Wait a moment", "What can you help with?"]
            },
            429,
            corsHeaders
          );
        }
      }

      // --- SMART CANNED RESPONSES ---
      
      // Salary inquiry
      if (lowerMsg.includes("salary") || lowerMsg.includes("compensation") || lowerMsg.includes("rate")) {
        return jsonReply(
          {
            errorType: null,
            reply: "I'm open to market-aligned compensation for operations roles. If you share the range, I can confirm fit. You can also reach Estivan at [hello@estivanayramia.com](mailto:hello@estivanayramia.com).",
            chips: buildChips(lowerMsg),
            action: "email_link",
            card: null,
            debug: buildDebugInfo(isDebug, lowerMsg, "smart_canned_salary")
          },
          200,
          corsHeaders
        );
      }

      // Contact inquiry
      if (lowerMsg.includes("email") || lowerMsg.includes("contact") || lowerMsg.includes("reach")) {
        return jsonReply(
          {
            errorType: null,
            reply: "You can reach Estivan directly at [hello@estivanayramia.com](mailto:hello@estivanayramia.com) or visit the [Contact Page](/contact.html). He usually responds within 24 hours.",
            chips: buildChips(lowerMsg),
            action: "email_link",
            card: null,
            debug: buildDebugInfo(isDebug, lowerMsg, "smart_canned_contact")
          },
          200,
          corsHeaders
        );
      }

      // Resume request
      if (lowerMsg.includes("resume") || lowerMsg.includes("cv") || lowerMsg.includes("download")) {
        return jsonReply(
          {
            errorType: null,
            reply: "Here's Estivan's resume! Click below to download the [PDF](/assets/docs/Estivan-Ayramia-Resume.pdf).",
            chips: buildChips(lowerMsg),
            action: "download_resume",
            card: null,
            debug: buildDebugInfo(isDebug, lowerMsg, "smart_canned_resume")
          },
          200,
          corsHeaders
        );
      }

      // Project inquiries
      if (lowerMsg.includes("logistics") || lowerMsg.includes("supply chain")) {
        return jsonReply(
          {
            errorType: null,
            reply: "The [Logistics System](/project-logistics.html) automated supply chain operations to improve delivery times. Check out the full case study!",
            chips: buildChips(lowerMsg),
            card: "logistics",
            action: null,
            debug: buildDebugInfo(isDebug, lowerMsg, "smart_canned_logistics")
          },
          200,
          corsHeaders
        );
      }

      // Handle Whispers clarification - it's a HOBBY, not a project
      if (lowerMsg.includes("whispers") || lowerMsg.includes("getwispers") || lowerMsg.includes("get wispers")) {
        if (lowerMsg.includes("getwispers") || lowerMsg.includes("get wispers")) {
          // getWispers is not a real project
          return jsonReply(
            {
              errorType: null,
              reply: "That project is not listed on the portfolio site. Check out [Projects](/projects/) to see Estivan's actual work, or reach out at [Contact](/contact.html) for more information.",
              chips: siteFacts.projects.slice(0, 3).map(p => p.title),
              debug: buildDebugInfo(isDebug, lowerMsg, "getwispers_correction")
            },
            200,
            corsHeaders
          );
        } else {
          // Whispers is a hobby
          return jsonReply(
            {
              errorType: null,
              reply: "[Whispers (Sticky Notes)](/hobbies/whispers.html) is one of Estivan's hobbies - a low-tech way to capture random thoughts and ideas on sticky notes. It's not a project. Check out [Hobbies](/hobbies/) for more.",
              chips: siteFacts.hobbies.slice(0, 4).map(h => h.title),
              debug: buildDebugInfo(isDebug, lowerMsg, "whispers_hobby_clarification")
            },
            200,
            corsHeaders
          );
        }
      }

      if (lowerMsg.includes("conflict") || lowerMsg.includes("playbook")) {
        return jsonReply(
          {
            errorType: null,
            reply: "The [Conflict Resolution Playbook](/project-conflict.html) standardized de-escalation protocols to improve workplace safety.",
            chips: buildChips(lowerMsg),
            card: "conflict",
            action: null,
            debug: buildDebugInfo(isDebug, lowerMsg, "smart_canned_conflict")
          },
          200,
          corsHeaders
        );
      }

      // --- VALIDATE API KEY ---
      if (!env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY missing");
        return jsonReply(
          { errorType: "ConfigError", reply: "Service temporarily unavailable. Please try again later." },
          503,
          corsHeaders
        );
      }

      // --- BUILD SYSTEM CONTEXT ---
      const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "America/Los_Angeles"
      });

      const context = `
SYSTEM: You are Savonie, Estivan Ayramia's portfolio concierge. Your job is to route visitors, answer questions accurately, and push them toward action: Contact → Resume → Projects.
DATE: ${today}
USER LANGUAGE: ${language || "English"} (Reply in this language!)

*** YOUR MISSION (TRUTH-FIRST CONCIERGE) ***
1. Answer the visitor's question directly and accurately
2. Keep responses SHORT (2-4 sentences) and information-dense
3. NEVER invent information you don't have - if you don't know, say so and redirect to [Contact](/contact.html) or hello@estivanayramia.com
4. NO mailto: links - just show the email address or contact page link
5. Always end with a clear next action or question
6. Speak in THIRD PERSON by default ("Estivan is...", "He does...")
7. Switch to FIRST PERSON only if visitor asks for "Estivan's voice" or "speak as Estivan"

*** CRITICAL: WHISPERS IS A HOBBY, NOT A PROJECT ***
- "Whispers" / "Whispers (Sticky Notes)" = HOBBY (capturing thoughts on sticky notes)
- "getWispers" / "get Wispers" = DOES NOT EXIST (never mention this)
- If asked about whispers, clarify it's a hobby and link to /hobbies/whispers.html
- If asked about getWispers, say it's not listed and link to /projects/

*** BOUNDARIES (FAMILY-SAFE & PROFESSIONAL) ***
✅ CAN discuss: Projects, skills, education, hobbies, career goals, personality, values
❌ NEVER discuss: Sexual content, health diagnoses, family drama, exact addresses, political debates
If asked inappropriate questions: "Professional inquiries only. Check out [Projects](/projects/) or [Contact](/contact.html) instead."

*** WHO ESTIVAN IS ***
- **Name**: Estivan Ayramia (He/Him), 21 years old
- **Location**: El Cajon, CA (San Diego area)
- **Background**: Born in Baghdad, moved to Syria as refugee, immigrated to USA in 2008
- **Languages**: English (strongest), Chaldean (spoken), Spanish & Arabic (conversational)
- **Education**: SDSU, General Business, graduating Dec 18, 2025 (3.8 GPA)
- **Personality**: Happy, curious, outgoing, competitive (10/10), glass-half-full mindset
- **Core Values**: Success, discipline, kindness, loyalty, truth over comfort

*** EXPERIENCE & SKILLS ***
- **3 years coaching** middle/high school students (communication & leadership)
- **Focus areas**: Supply Chain, Logistics, Operations, Project Execution
- **Tech skills**: Building systems, DevOps concepts, full-stack development mindset
- **Pattern recognition**: Naturally analytical, questions everything, loves learning

*** KEY PROJECTS ***
Use the siteFacts.projects array as the authoritative source. Current projects:
${siteFacts.projects.map(p => `- **${p.title}**: ${p.summary}`).join('\n')}

*** HOBBIES & INTERESTS ***
Use the siteFacts.hobbies array as the authoritative source. Current hobbies:
${siteFacts.hobbies.map(h => `- **${h.title}**: ${h.summary}`).join('\n')}

*** CAREER GOALS ***
- **Next year**: High-paying job, clear 5-year plan, closer to owning house
- **5 years**: Making $1M+/year, strong network, career he actually enjoys
- **Lifetime**: Happy family, financial freedom, travel the world

*** PERSONALITY TRAITS ***
- **Strengths**: Willing to change, loves learning, "always a good day to be happy"
- **Working on**: Reducing ego, thinking before speaking, celebrating small wins
- **Social**: Zero social anxiety, handles confrontation like an adult, adaptable humor
- **Emotional**: High awareness, logic > instinct > emotion, competitive but not jealous
- **Decision-making**: Decisive on big things, overthinks food choices

*** WHAT ESTIVAN WANTS VISITORS TO KNOW ***
- He's approachable and willing to help
- At his core, he's a nice person who wants to improve lives
- He believes everything happens for a reason, so no point in regret
- Success matters, but so does staying grounded and kind
- He's building independence while staying close to family

*** SMART ACTIONS (TRIGGER THESE) ***
When visitor mentions these keywords, suggest these actions:
- "resume" / "CV" / "download" → Point to [Resume](/assets/docs/Estivan-Ayramia-Resume.pdf)
- "contact" / "email" / "hire" / "reach out" → Point to [Contact](/contact.html) or hello@estivanayramia.com
- "LinkedIn" → Mention professional networking
- "logistics" / "supply chain" → Highlight the relevant project from site-facts
- "whispers" / "sticky notes" → Clarify this is a HOBBY (not a project), link to /hobbies/whispers.html
- "conflict" / "workplace" → Highlight the relevant project from site-facts
- "projects" → Link to [Projects](/projects/) to see all work

*** OUTPUT RULES ***
- Write in clean Markdown only
- NO JSON in your response
- Keep it SHORT and useful
- End with a question or clear next step
- Use provided links naturally in sentences

*** GREETING STRATEGY ***
If visitor says "hi"/"hello":
- Friendly 1-sentence hello
- Ask what they want to know: projects, resume, background, or something specific
- DON'T dump full bio unless asked

*** TONE ***
- Direct, blunt, no corporate fluff
- Information-dense but friendly
- Truth over vibes (say "I don't know" if you don't know)
- Supportive with positive spin on truth (not hiding reality, just framing it constructively)
- Comfortable, charismatic, never rude or vulgar

*** PAGE CONTEXT RULE ***
Current page: ${pageContent || "Home"}
If asked about page-specific content you don't have info about:
- Say "I don't have that specific information right now"
- Offer: "Check out [Contact](/contact.html) or email hello@estivanayramia.com and Estivan will answer directly"
- NEVER make up page details
`.trim();

      // --- CALL GEMINI WITH EXTENDED LOGIC ---
      let maxTokens = 900;
      if (lowerMsg.includes("detailed") || lowerMsg.includes("explain") || lowerMsg.includes("story") || lowerMsg.includes("step by step")) {
        maxTokens = 1200;
      }

      let data;
      let finalReply = "";
      let isTruncated = false;

      try {
        // Initial call
        data = await callGeminiWithRetry(
          cachedModel,
          context,
          sanitizedMessage,
          env.GEMINI_API_KEY,
          maxTokens,
          { msgLen: userMessage.length }
        );

        console.log("Initial Gemini call completed:", { hasData: !!data, hasError: !!(data?.error), errorCode: data?.error?.code });

        // If Gemini returns any structured error, retry once with a fallback model.
        if (data?.error) {
          console.log("Gemini call error", {
            code: data.error.code,
            status: data.error.status || null,
            model: cachedModel,
            msgLen: userMessage.length
          });

          if (!String(cachedModel).includes("pro")) {
            cachedModel = "gemini-2.5-pro";
            data = await callGeminiWithRetry(
              cachedModel,
              context,
              sanitizedMessage,
              env.GEMINI_API_KEY,
              maxTokens,
              { msgLen: userMessage.length }
            );
          }
        }

        if (data?.error) {
          throw new Error(`Gemini Error: ${JSON.stringify({ code: data.error.code, status: data.error.status || null })}`);
        }

        // Process First Chunk
        let candidate = data?.candidates?.[0];
        let originalText = candidate?.content?.parts?.map(p => p.text).join("") || "";
        finalReply = originalText;

        // --- CONTINUATION LOGIC ---
        // Only auto-continue when the model likely stopped due to a cap.
        // Avoid extra calls when finishReason is STOP.
        const finishReason = candidate?.finishReason;
        const trimmed = String(originalText || "").trim();
        const lastChar = trimmed ? trimmed.slice(-1) : "";
        const endsCleanly = !trimmed || /[\.!\?\)\]"']$/.test(lastChar);

        const seemsTruncated =
          finishReason === "MAX_TOKENS" ||
          (!finishReason && !endsCleanly && trimmed.length > 1800);

        if (seemsTruncated) {
          console.log("Response truncated. Attempting continuation...");
          
          // Helper to get last chunk for context
          const tail = originalText.slice(-600); 
          const continuationPrompt = `You stopped mid-sentence. Please continue safely from: "...${tail}". Do not repeat the prefix. Just continuation.`;
          
          try {
            const part2 = await callGeminiWithRetry(
              cachedModel, 
              context, 
              `${sanitizedMessage}\n\nSYSTEM: ${continuationPrompt}`, 
              env.GEMINI_API_KEY, 
              500,
              { msgLen: userMessage.length }
            );
            
            const part2Text = part2?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
            if (part2Text) {
              finalReply += part2Text;
            }
          } catch (contErr) {
            console.warn("Continuation failed:", contErr);
            isTruncated = true; // Mark as truncated if we couldn't continue
          }
        }

        // --- CLEAN & PROCESS FINAL TEXT ---
        let cleaned = finalReply
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/, "")
          .replace(/\s*```$/, "")
          .trim();

        if (!cleaned) {
          return jsonReply(
            { errorType: "EmptyResponse", reply: "I couldn't generate a response.", chips: ["Projects", "Contact"] },
            502, 
            corsHeaders
          );
        }

        // 1. Strip JSON blobs (accidental leaks)
        let sanitizedReply = stripJsonBlobs(cleaned);

        // 2. Safe Truncate (Hard Limit)
        const wasLonger = sanitizedReply.length > MAX_REPLY_CHARS;
        sanitizedReply = safeTruncate(sanitizedReply, MAX_REPLY_CHARS);
        if (wasLonger) isTruncated = true;

        // 3. Linkify
        sanitizedReply = linkifyPages(sanitizedReply);

        // 4. Guardrail validation - prevent hallucinated projects
        const validation = validateProjectMentions(sanitizedReply);
        if (!validation.isValid) {
          console.log(`Guardrail triggered: hallucinated projects detected - ${validation.violations.join(', ')}`);
          // Replace with corrected reply and show real project chips
          sanitizedReply = validation.correctedReply;
          return jsonReply(
            {
              errorType: null,
              reply: sanitizedReply,
              chips: siteFacts.projects.slice(0, 3).map(p => p.title),
              guardrail_triggered: true,
              violations: validation.violations,
              debug: buildDebugInfo(isDebug, lowerMsg, "guardrail_correction")
            },
            200,
            corsHeaders
          );
        }

        return jsonReply(
          {
            errorType: null,
            reply: sanitizedReply,
            chips: buildChips(lowerMsg),
            truncated: isTruncated,
            continuation_hint: isTruncated ? sanitizedReply.slice(-1000) : null,
            reply_length: sanitizedReply.length,
            action: null,
            card: null,
            debug: buildDebugInfo(isDebug, lowerMsg, "gemini_ai")
          },
          200,
          corsHeaders
        );

      } catch (err) {
        console.error("Gemini processing error:", err.message, err.stack);
        
        // Parse error to determine upstream status
        let upstreamCode = 500;
        let upstreamStatus = "UNKNOWN_ERROR";
        let debugInfo = { errorMessage: err.message, stack: err.stack?.slice(0, 200) };
        
        if (err.message.includes('Gemini Error:')) {
          try {
            const errorJson = JSON.parse(err.message.replace('Gemini Error: ', ''));
            upstreamCode = errorJson.code || 500;
            upstreamStatus = errorJson.status || "UNKNOWN_ERROR";
          } catch (parseErr) {
            console.error("Failed to parse Gemini error:", parseErr);
          }
        } else if (err.message.includes('timeout') || err.message.includes('Request timeout')) {
          upstreamCode = 504;
          upstreamStatus = "TIMEOUT";
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          upstreamCode = 503;
          upstreamStatus = "NETWORK_ERROR";
        }
        
        // Always include debug info
        debugInfo = {
          ...debugInfo,
          upstreamStatus: upstreamCode,
          upstreamError: upstreamStatus,
          message: err.message.slice(0, 200),
          timestamp: new Date().toISOString()
        };
        
        // Determine response based on upstream error
        if (upstreamCode === 429) {
          return jsonReply(
            {
              errorType: "UpstreamBusy",
              reply: "The AI service is experiencing high demand. Please try again in a moment.",
              chips: ["Retry", "Projects", "Resume", "Contact"],
              debug: debugInfo
            },
            503,
            { ...corsHeaders, "Retry-After": "30" }
          );
        } else if (upstreamCode === 401 || upstreamCode === 403) {
          return jsonReply(
            {
              errorType: "AuthError",
              reply: "The AI service is misconfigured. Please try contacting support or explore Estivan's [Projects](/projects.html) and [Resume](/assets/docs/Estivan-Ayramia-Resume.pdf) directly.",
              chips: ["Projects", "Resume", "Contact"],
              debug: debugInfo
            },
            503,
            corsHeaders
          );
        } else if (upstreamCode === 504 || upstreamStatus === "TIMEOUT") {
          return jsonReply(
            {
              errorType: "Timeout",
              reply: "The AI service timed out. Please try again with a shorter question or explore Estivan's [Projects](/projects.html) directly.",
              chips: ["Retry", "Projects", "Resume", "Contact"],
              debug: debugInfo
            },
            504,
            corsHeaders
          );
        } else if ([500, 502, 503].includes(upstreamCode) || upstreamStatus === "NETWORK_ERROR") {
          return jsonReply(
            {
              errorType: "UpstreamError",
              reply: "The AI service is temporarily unavailable. Please try again later or explore Estivan's [Projects](/projects.html) and [Resume](/assets/docs/Estivan-Ayramia-Resume.pdf) directly.",
              chips: ["Retry", "Projects", "Resume", "Contact"],
              debug: debugInfo
            },
            503,
            corsHeaders
          );
        }
        
        // Offline fallback mode: deterministic helpful response
        const intent = detectIntent(lowerMsg);
        let fallbackReply = "";
        let fallbackChips = ["Projects", "Resume", "Contact", "Retry"];
        
        if (intent === "greeting") {
          fallbackReply = `Hello! I'm currently offline, but I can still help you navigate Estivan's portfolio. 

Estivan is a Software Engineer specializing in operations and infrastructure. He has experience with cloud platforms, DevOps, and full-stack development.

Quick links:
- [View Projects](/projects.html)
- [Download Resume](/assets/docs/Estivan-Ayramia-Resume.pdf)
- [Contact Estivan](/contact.html)`;
        } else if (intent === "projects") {
          // Use real projects from site-facts
          const projectList = siteFacts.projects.slice(0, 4).map(p => 
            `- **${p.title}**: ${p.summary}`
          ).join('\n');
          fallbackReply = `Here are some of Estivan's key projects:

${projectList}

[Explore all projects →](/projects/)`;
        } else if (intent === "summary") {
          fallbackReply = `Estivan Ayramia is a Business graduate from SDSU based in San Diego, specializing in operations and strategic execution.

**Background**: Born in Baghdad/Syria (2004), SDSU General Business (3.8 GPA). 3 years coaching experience.

**Focus Areas**: Supply Chain, Logistics, Operations, Project Execution.

**Key Projects**: ${siteFacts.projects.slice(0, 3).map(p => p.title).join(', ')}.

[View full resume →](/assets/docs/Estivan-Ayramia-Resume.pdf)`;
        } else {
          fallbackReply = `I'm currently offline, but I can help you navigate Estivan's portfolio. 

**Quick Options**:
- [Projects](/projects/) - Browse his work
- [Resume](/assets/docs/Estivan-Ayramia-Resume.pdf) - Download his CV
- [Contact](/contact.html) - Reach out directly at hello@estivanayramia.com

Estivan is a Business graduate specializing in operations and strategic execution with experience in supply chain, logistics, and project management.`;
        }
        
        return jsonReply(
          {
            errorType: "OfflineMode",
            reply: fallbackReply,
            chips: fallbackChips,
            truncated: false,
            continuation_hint: null,
            reply_length: fallbackReply.length,
            action: null,
            card: null,
            debug: debugInfo
          },
          200, // Return 200 for fallback to keep UI functional
          corsHeaders
        );
      }

    } catch (error) {
      console.error("Worker error:", error.message, error.stack);
      
      return jsonReply(
        {
          errorType: "SystemError",
          reply: "An unexpected error occurred. Please try again.",
          chips: ["View Projects", "Contact Support"]
        },
        500,
        corsHeaders
      );
    }
  }
};

// ============================================================================
// GEMINI API HELPER
// ============================================================================
async function callGemini(modelName, context, userMessage, apiKey, maxTokens = 500) {
  const cleanName = modelName.startsWith("models/") 
    ? modelName 
    : `models/${modelName}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/${cleanName}:generateContent`;
  
  console.log("Calling Gemini API:", { model: cleanName, url });

  const resp = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${context}\n\nUSER ASKS: ${userMessage}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: maxTokens,
          topP: 0.95
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    },
    GEMINI_TIMEOUT
  );

  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Gemini JSON. Raw text:", text.slice(0, 200));
    // Return a structured error instead of throwing, so auto-heal can catch 404s/500s
    return {
      error: {
        code: resp.status,
        message: `Invalid JSON from upstream: ${text.replace(/\s+/g, ' ').slice(0, 50)}...`,
        status: "PARSING_ERROR"
      }
    };
  }

  if (!resp.ok) {
    console.error("Gemini API error response:", JSON.stringify(json).slice(0, 300));
    if (!json.error) {
      json.error = {
        code: resp.status,
        message: `HTTP ${resp.status} from Gemini`
      };
    }
  }

  return json;
}