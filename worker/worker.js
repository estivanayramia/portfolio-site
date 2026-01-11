// ============================================================================
// SAVONIE AI - ESTIVAN'S PORTFOLIO CHATBOT
// Cloudflare Worker with Rate Limiting, Smart Signals, & Auto-Healing
// ============================================================================

let cachedModel = "models/gemini-1.5-flash";
const GEMINI_TIMEOUT = 25000;
const MAX_MESSAGE_LENGTH = 2000;

// Optional local rate limiter (fallback if env.RATE_LIMITER not configured)
const localRateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60000; // 60 seconds
const RATE_LIMIT_MAX = 20;

function extractFirstJsonObjectRange(text, fromIndex = 0) {
  if (typeof text !== "string" || !text) return null;
  const startAt = Math.max(0, fromIndex | 0);

  for (let i = startAt; i < text.length; i++) {
    if (text[i] !== "{") continue;

    let objectStart = i;
    let braceDepth = 1;
    let inString = false;
    let stringQuote = null;
    let escaped = false;

    for (let j = i + 1; j < text.length; j++) {
      const ch = text[j];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === stringQuote) {
          inString = false;
          stringQuote = null;
        }
        continue;
      }

      if (ch === '"' || ch === "'") {
        inString = true;
        stringQuote = ch;
        continue;
      }

      if (ch === "{") {
        braceDepth++;
        continue;
      }

      if (ch === "}") {
        braceDepth--;
        if (braceDepth === 0) {
          return { start: objectStart, end: j + 1, json: text.slice(objectStart, j + 1) };
        }
      }
    }
  }

  return null;
}

function extractFirstJsonObject(text) {
  return extractFirstJsonObjectRange(text)?.json ?? null;
}

function safeParseJson(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function stripParsedJsonObjects(text) {
  if (typeof text !== "string" || !text) return "";
  let out = text;
  let searchFrom = 0;

  while (true) {
    const range = extractFirstJsonObjectRange(out, searchFrom);
    if (!range) break;

    const isParsable = safeParseJson(range.json);
    // Heuristic: if it looks like our schema (contains our field names), strip it even if invalid JSON
    const looksLikeSchema = /"(reply|chips|action|card|errorType)"\s*:/.test(range.json);

    if (isParsable || looksLikeSchema) {
      out = (out.slice(0, range.start) + out.slice(range.end)).trim();
      searchFrom = 0;
      continue;
    }

    searchFrom = range.start + 1;
    if (searchFrom >= out.length) break;
  }

  return out.trim();
}

function detectIntent(lowerMsg) {
  const msg = typeof lowerMsg === "string" ? lowerMsg : "";

  if (/(^|\b)(hi|hello|hey|yo|good morning|good afternoon|good evening)(\b|!|\.)/.test(msg)) return "greeting";
  if (/(recruiter|hiring manager|interview|role|position|opportunity|availability|available|start date)/.test(msg)) return "recruiter";
  if (/(email|contact|reach|message|connect)/.test(msg)) return "contact";
  if (/(salary|compensation|rate|pay|wage|range)/.test(msg)) return "salary";
  if (/(project|projects|case study|portfolio|work samples|experience)/.test(msg)) return "projects";
  if (/(who are you|about you|about estivan|summary|tell me about|elevator pitch|quick summary)/.test(msg)) return "summary";
  if (/(hobbies|hobby|gym|workout|fitness|car|cars|reading|books|cooking|photography|whispers)/.test(msg)) return "hobbies";

  return "default";
}

function buildChips(lowerMsg) {
  switch (detectIntent(lowerMsg)) {
    case "greeting":
      return ["Quick summary", "View projects", "Get resume"];
    case "summary":
      return ["Key strengths", "Best projects", "Resume"];
    case "projects":
      return ["Operations systems work", "Portfolio site build", "Other case studies"];
    case "recruiter":
      return ["Availability", "Location", "Resume"];
    case "contact":
      return ["Email", "LinkedIn", "Resume"];
    case "salary":
      return ["Target roles", "Availability", "Contact"];
    case "hobbies":
      return ["Gym and discipline", "Cars", "Reading"];
    default:
      return ["Projects", "Skills", "Contact"];
  }
}

function shouldAllowModelChips(lowerMsg) {
  const msg = typeof lowerMsg === "string" ? lowerMsg : "";
  return /(what else can i ask|what can i ask|what should i ask|how can you help)/.test(msg);
}

function normalizeSmartResponse(obj) {
  const replyRaw = typeof obj?.reply === "string" ? obj.reply : String(obj?.reply ?? "");

  return {
    reply: stripParsedJsonObjects(replyRaw),
    chips: Array.isArray(obj?.chips)
      ? obj.chips
          .filter(c => typeof c === "string")
          .map(c => c.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [],
    action: typeof obj?.action === "string" ? obj.action : null,
    card: typeof obj?.card === "string" ? obj.card : null
  };
}

function finalizeResponse(body, lowerMsg) {
  const allowedActions = new Set(["download_resume", "email_link"]);
  const allowedCards = new Set(["logistics", "conflict", "discipline", "website"]);

  const chips =
    shouldAllowModelChips(lowerMsg) && Array.isArray(body?.chips) && body.chips.length
      ? body.chips.slice(0, 3)
      : buildChips(lowerMsg);

  return {
    errorType: body?.errorType ?? null,
    reply: typeof body?.reply === "string" ? body.reply : String(body?.reply ?? ""),
    chips: Array.isArray(chips) ? chips.slice(0, 3) : [],
    action: allowedActions.has(body?.action) ? body.action : null,
    card: allowedCards.has(body?.card) ? body.card : null
  };
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
  const allowedActions = new Set(["download_resume", "email_link"]);
  const allowedCards = new Set(["logistics", "conflict", "discipline", "website"]);

  const payload = {
    errorType: body?.errorType ?? null,
    reply: typeof body?.reply === "string" ? body.reply : String(body?.reply ?? ""),
    chips: Array.isArray(body?.chips)
      ? body.chips
          .filter(c => typeof c === "string")
          .map(c => c.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [],
    action: allowedActions.has(body?.action) ? body.action : null,
    card: allowedCards.has(body?.card) ? body.card : null
  };

  return new Response(JSON.stringify(payload), {
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
            reply: "I'm open to market-aligned compensation for operations roles and happy to talk details. If you share the range, I can confirm fit and next steps. You can also reach Estivan at [hello@estivanayramia.com](mailto:hello@estivanayramia.com).",
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
            reply: "You can reach Estivan directly at [hello@estivanayramia.com](mailto:hello@estivanayramia.com). He aims to respond within 24 hours.",
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
            reply: "Here's Estivan's resume! Click below to download the PDF.",
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
            reply: "The Logistics System automated supply chain operations and reduced delivery delays by 35%. Check out the full case study!",
            card: "logistics",
            chips: buildChips(lowerMsg),
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
            reply: "The Conflict Resolution Playbook standardized de-escalation protocols and reduced workplace incidents by 40%.",
            card: "conflict",
            chips: buildChips(lowerMsg),
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

*** TONE + ADVOCACY (NON-NEGOTIABLE) ***
- Professional, confident, supportive.
- Always advocate for Estivan with positive framing.
- Never insult, diminish, or talk down.
- If asked about weaknesses: frame as growth areas + mitigation + strengths.
- Do not invent credentials, titles, or experience.
- Describe Estivan as an early-career operations and systems candidate: process improvement, logistics thinking, execution.

*** OUTPUT FORMAT (STRICT) ***
Return ONLY valid JSON. Do not include any other text before or after the JSON.
Do not wrap in code fences.
Markdown is allowed ONLY inside the "reply" string.
Keep chips to a maximum of 3.

Schema example:
{
  "reply": "(string, may contain markdown)",
  "chips": ["(string)", "(string)", "(string)"],
  "action": "download_resume" | "email_link" | null,
  "card": "logistics" | "conflict" | "discipline" | "website" | null
}

*** NAVIGATION LINKS ***
Use markdown links for navigation:
- Full projects: [View Projects](/projects.html)
- Deep dive story: [Read Deep Dive](/deep-dive.html)
- Quick overview: [View Overview](/overview.html)
- Contact page: [Contact](/contact.html)
- Logistics: [View Logistics](/deep-dive.html#logistics)
- Conflict Playbook: [View Strategy](/deep-dive.html#conflict)

*** ESTIVAN'S BACKGROUND ***
**Current Status**: Seeking operations roles (Supply Chain, Logistics, Project Management)
**Location**: Southern California
**Email**: hello@estivanayramia.com
**LinkedIn**: [linkedin.com/in/estivanayramia](https://linkedin.com/in/estivanayramia)

**Key Projects**:
1. **Logistics System** - Automated supply chain operations, reduced delivery delays 35%, cut fuel costs 18%
2. **Conflict Resolution Playbook** - Standardized de-escalation protocols, reduced incidents 40%
3. **Discipline Tracking System** - Progressive discipline workflow, improved compliance 50%
4. **Portfolio Website** - Modern PWA with offline support, achievements, analytics

**Skills**: Supply Chain, Logistics, Conflict Resolution, Process Improvement, Data Analysis, Team Leadership

**Education**: California State University San Marcos (CSUSM)

**Achievements**: 
- Explorer (visited all pages)
- Deep Diver (spent 30s on deep dive)
- Conversationalist (opened chat)
- 8 total achievements available

*** SPECIAL MODES ***
- If user asks to "quiz me" or "play a game": Ask trivia about Estivan's background
- If user mentions Konami code: Reference the easter egg (↑↑↓↓←→←→BA)
- If discussing achievements: Explain the 8-achievement system

*** RESPONSE GUIDELINES ***
- Keep responses under 100 words unless explaining a complex project
- Use chips for follow-up suggestions (max 3)
- Trigger actions when appropriate (resume downloads, email links)
- Show project cards when discussing specific projects
- Be human, not robotic

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

      // --- CLEAN CODE BLOCKS & PARSE SMART SIGNALS ---
      // CORRECTED REGEX SECTION BELOW
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
            chips: ["View Projects", "About Estivan", "Contact"]
          },
          502,
          corsHeaders
        );
      }

      const parsedStrict = safeParseJson(cleaned);
      const parsedFromExtracted = parsedStrict ? null : safeParseJson(extractFirstJsonObject(cleaned));
      const parsed = parsedStrict || parsedFromExtracted;

      const responseObj = parsed
        ? normalizeSmartResponse(parsed)
        : {
            reply: stripParsedJsonObjects(cleaned),
            chips: [],
            action: null,
            card: null
          };

      const finalBody = finalizeResponse(
        {
          errorType: null,
          reply: responseObj.reply,
          chips: responseObj.chips,
          action: responseObj.action,
          card: responseObj.card
        },
        lowerMsg
      );

      return jsonReply(finalBody, 200, corsHeaders);

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
          temperature: 0.4,
          maxOutputTokens: 700,
          topP: 0.9,
          responseMimeType: "application/json"
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