// ============================================================================
// SAVONIE AI - ESTIVAN'S PORTFOLIO CHATBOT
// Cloudflare Worker with Rate Limiting, Smart Signals, & Auto-Healing
// ============================================================================

let cachedModel = "models/gemini-1.5-flash";
const GEMINI_TIMEOUT = 25000;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REPLY_CHARS = 3000;
const VERSION_TAG = "v2026.01.11-friendly-fix-v1";

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
 * Auto-linkify key pages if they are not already linked
 */
function linkifyPages(text) {
  if (!text) return "";
  
  // Helper to replace word if not inside [link](url)
  // We use a simplified approach: just strict replacements if the exact case-insensitive plain word exists.
  // Note: This is best-effort. The prompt instructions are the primary defense.
  
  const map = [
    { word: "Overview", link: "[Overview](/overview.html)" },
    { word: "Projects", link: "[Projects](/projects.html)" },
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
  if (/(project|projects|case study|portfolio|work samples|experience)/.test(lowerMsg)) return "projects";
  if (/(who is he|who are you|about you|about estivan|summary|tell me about|elevator pitch|quick summary|bio|background)/.test(lowerMsg)) return "summary";
  if (/(hobbies|hobby|gym|workout|fitness|car|cars|reading|books|cooking|photography|whispers)/.test(lowerMsg)) return "hobbies";
  return "default";
}

/**
 * Get deterministic chips based on user intent
 */
function buildChips(lowerMsg) {
  const intent = detectIntent(lowerMsg);
  
  // Chip sets mapping to actionable buttons in frontend
  // Frontend handles: "Projects", "Resume", "Contact", "LinkedIn" specially.
  
  switch (intent) {
    case "greeting":
      return ["Quick summary", "Projects", "Resume"];
    case "summary":
      return ["Projects", "Resume", "Contact"];
    case "projects":
      // "Operations work" and "Site build" are text queries; "Contact" is action
      return ["Operations work", "Site build", "Contact"];
    case "recruiter":
      return ["Availability", "Location", "Resume"];
    case "contact":
      return ["Email", "LinkedIn", "Resume"];
    case "salary":
      return ["Projects", "Resume", "Contact"];
    case "hobbies":
      return ["Gym routine", "Cars", "Reading list"];
    default:
      return ["Projects", "Resume", "Contact"];
  }
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
  
  // Add any dev origins here (e.g. Vite/Live Server ports like 5173, 5500, etc)
  const allowedOrigins = [
    "https://estivanayramia.com",
    "https://www.estivanayramia.com",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
  ];
  
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
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
    headers: { ...corsHeaders, "Content-Type": "application/json" }
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

      const { message, pageContent, language } = body || {};

      if (typeof message !== "string" || !message.trim()) {
        return jsonReply(
          { errorType: "BadRequest", reply: "Missing or empty 'message'." },
          400,
          corsHeaders
        );
      }

      // Sanitize message
      const sanitizedMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);
      const lowerMsg = sanitizedMessage.toLowerCase();
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
                reply: "Whoa, too fast! Give me a minute to catch up. ⏱️"
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
              reply: "Whoa, too fast! Give me a minute to catch up. ⏱️"
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
            card: null
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
            card: null
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
            card: null
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
            action: null
          },
          200,
          corsHeaders
        );
      }

      if (lowerMsg.includes("conflict") || lowerMsg.includes("playbook")) {
        return jsonReply(
          {
            errorType: null,
            reply: "The [Conflict Resolution Playbook](/project-conflict.html) standardized de-escalation protocols to improve workplace safety.",
            chips: buildChips(lowerMsg),
            card: "conflict",
            action: null
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
SYSTEM: You are Savonie AI, Estivan Ayramia's personal portfolio assistant.
DATE: ${today}
USER LANGUAGE: ${language || "English"} (Reply in this language!)

*** RULES (STRICT) ***
1. **Answer First**: Answer the user's specific question immediately. Do not start with a bio unless asked "tell me about yourself".
2. **Concise & Witty**: Keep replies short (2-4 sentences). Be confident, friendly, and slightly witty. No lengthy paragraphs.
3. **No Slogans**: Do NOT use "Systems over Chaos", "Game changer", "Ops pro", or similar hype.
4. **Truthful**: Do NOT invent titles/metrics. Do NOT claim "Operations Manager". Title: "Operations/Systems Candidate" or "General Business Grad".
5. **No Emojis**: Do not use emojis unless the user uses them first.
6. **Plain Text Only**: Output clean Markdown. No JSON blobs.

*** LINKS ***
Use these markdown links naturally:
- [Overview](/overview.html)
- [Projects](/projects.html)
- [Contact](/contact.html)
- [Resume](/assets/docs/Estivan-Ayramia-Resume.pdf)

*** ESTIVAN'S PROFILE (FACTS) ***
- **Name**: Estivan Ayramia (He/Him). Lives in El Cajon, CA (San Diego) since 2008.
- **Origin**: Born Jan 21, 2004 in Baghdad. Lived in Syria.
- **Ed**: General Business, San Diego State University (SDSU).
- **Languages**: English, Chaldean (spoken), conversational Arabic/Spanish.
- **Goal**: Supply Chain, Logistics, or Project Execution roles.
- **Projects**: Logistics System (automation/efficiency), Conflict Playbook (safety/protocols), Discipline System (consistency), Portfolio PWA.
- **Hobbies**: Gym (discipline), Cars, Reading.

*** GREETING STRATEGY ***
If user says "hi"/"hello":
- Say a quick friendly hello.
- Ask how you can help (e.g., "Want to see my projects or grab my resume?").
- Do NOT dump the full bio.

PAGE CONTEXT: ${pageContent || "Home"}
`.trim();

      // --- CALL GEMINI WITH TIMEOUT ---
      let data;
      try {
        data = await callGemini(cachedModel, context, sanitizedMessage, env.GEMINI_API_KEY);
      } catch (err) {
        console.error("Gemini error:", err.message);
        
        if (err.message === 'Request timeout') {
          return jsonReply(
            {
              errorType: "Timeout",
              reply: "I'm thinking too hard! Try a shorter question?",
              chips: ["View Projects", "Contact Estivan", "Download Resume"]
            },
            504,
            corsHeaders
          );
        }
        
        return jsonReply(
          {
            errorType: "UpstreamError",
            reply: "I'm temporarily offline. Try again in a moment!",
            chips: ["View Projects", "Contact Page"]
          },
          502,
          corsHeaders
        );
      }

      // --- AUTO-HEAL MODEL ERRORS ---
      if (data?.error?.code === 404 || 
          (data?.error?.message && 
           (data.error.message.includes("not found") || 
            data.error.message.includes("unsupported")))) {
        
        console.log(`Model ${cachedModel} failed. Auto-detecting...`);

        try {
          const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`;
          const listResp = await fetchWithTimeout(listUrl, {}, 5000);
          const listData = await listResp.json().catch(() => null);

          if (listResp.ok && Array.isArray(listData?.models)) {
            const bestModel = listData.models.find(
              m => m.name?.includes("flash") && 
                   m.supportedGenerationMethods?.includes("generateContent")
            ) || listData.models.find(
              m => m.name?.includes("pro") && 
                   m.supportedGenerationMethods?.includes("generateContent")
            );

            if (bestModel?.name) {
              cachedModel = bestModel.name;
              console.log("✓ Switched to:", cachedModel);
              data = await callGemini(cachedModel, context, sanitizedMessage, env.GEMINI_API_KEY);
            }
          }
        } catch (healErr) {
          console.error("Auto-heal failed:", healErr.message);
        }
      }

      // --- HANDLE GEMINI ERRORS ---
      if (data?.error) {
        console.error("Gemini error:", JSON.stringify(data.error));
        
        return jsonReply(
          {
            errorType: "AIError",
            reply: "I'm having trouble thinking right now. Try again in a moment!",
            chips: ["View Projects", "Contact Estivan"]
          },
          502,
          corsHeaders
        );
      }

      // --- EXTRACT RAW TEXT (JOIN MULTIPLE PARTS) ---
      const parts = data?.candidates?.[0]?.content?.parts;
      
      if (!Array.isArray(parts) || parts.length === 0) {
        console.warn("Empty AI response - no parts");
        return jsonReply(
          {
            errorType: "EmptyResponse",
            reply: "The AI did not return any content. Please try rephrasing your question.",
            chips: ["View Projects", "About Estivan", "Contact"]
          },
          502,
          corsHeaders
        );
      }

      // Join all text parts with double newlines
      const rawText = parts
        .filter(part => part.text && typeof part.text === "string")
        .map(part => part.text)
        .join("\n\n");

      if (!rawText || !rawText.trim()) {
        console.warn("Empty AI response after joining parts");
        return jsonReply(
          {
            errorType: "EmptyResponse",
            reply: "The AI did not return any content. Please try rephrasing your question.",
            chips: ["View Projects", "About Estivan", "Contact"]
          },
          502,
          corsHeaders
        );
      }

      // --- CLEAN CODE BLOCKS & STRIP JSON BLOBS ---
      let cleaned = rawText
        .replace(/^```json\s*/i, "")  // Remove start fence with optional 'json'
        .replace(/^```\s*/, "")       // Remove start fence without language
        .replace(/\s*```$/, "")       // Remove end fence
        .trim();

      if (!cleaned) {
        return jsonReply(
          {
            errorType: "EmptyResponse",
            reply: "The AI did not return any content. Please try rephrasing your question.",
            chips: buildChips(lowerMsg),
            action: null,
            card: null
          },
          502,
          corsHeaders
        );
      }

      // Strip any JSON blobs from reply
      let sanitizedReply = stripJsonBlobs(cleaned).slice(0, MAX_REPLY_CHARS).trim();
      
      // Auto-linkify key pages if missed by model
      sanitizedReply = linkifyPages(sanitizedReply);

      if (!sanitizedReply) {
        return jsonReply(
          {
            errorType: "EmptyResponse",
            reply: "The AI did not return any content. Please try rephrasing your question.",
            chips: buildChips(lowerMsg),
            action: null,
            card: null
          },
          502,
          corsHeaders
        );
      }

      return jsonReply(
        {
          errorType: null,
          reply: sanitizedReply,
          chips: buildChips(lowerMsg),
          action: null,
          card: null
        },
        200,
        corsHeaders
      );

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
async function callGemini(modelName, context, userMessage, apiKey) {
  const cleanName = modelName.startsWith("models/") 
    ? modelName 
    : `models/${modelName}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/${cleanName}:generateContent?key=${apiKey}`;

  const resp = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
          maxOutputTokens: 500,
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

  let json;
  try {
    json = await resp.json();
  } catch (e) {
    console.error("Failed to parse Gemini JSON:", e);
    throw new Error("Failed to parse Gemini response");
  }

  if (!resp.ok && !json.error) {
    json.error = {
      code: resp.status,
      message: `HTTP ${resp.status} from Gemini`
    };
  }

  return json;
}