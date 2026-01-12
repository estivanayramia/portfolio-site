// ============================================================================
// SAVONIE AI - ESTIVAN'S PORTFOLIO CHATBOT
// Cloudflare Worker with Rate Limiting, Smart Signals, & Auto-Healing
// ============================================================================

let cachedModel = "models/gemini-1.5-flash";
const GEMINI_TIMEOUT = 35000; // Increased to account for larger tokens/retries
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REPLY_CHARS = 8000; // Increased from 3000
const VERSION_TAG = "v2026.01.11-dynamic-audit";

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
      return ["Logistics System", "Whispers App", "Contact"];
    case "recruiter":
      return ["Availability", "Location", "Resume"];
    case "contact":
      return ["Email", "LinkedIn", "Resume"];
    case "salary":
      return ["Projects", "Resume", "Contact"];
    case "hobbies":
      return ["Gym routine", "BMW 540i", "Reading list"];
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

// Retry Gemini calls once for transient upstream failures.
// Logs lengths and flags only, never user content.
async function callGeminiWithRetry(modelName, context, userMessage, apiKey, maxTokens, meta) {
  const first = await callGemini(modelName, context, userMessage, apiKey, maxTokens);
  if (!first?.error) return first;

  const code = Number(first.error.code || 0);
  const retryable = code === 429 || code === 500 || code === 502 || code === 503 || code === 504;

  console.log("Gemini retry check", {
    model: modelName,
    maxTokens,
    msgLen: meta?.msgLen ?? null,
    code,
    retryable
  });

  if (!retryable) return first;

  await new Promise((r) => setTimeout(r, 400));
  return await callGemini(modelName, context, userMessage, apiKey, maxTokens);
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

      const { message, pageContent, language, previousContext } = body || {};

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
1. **Answer First**: Answer the user's specific question immediately. Do not start with a bio unless asked.
2. **Concise & Witty**: Keep replies short (2-4 sentences). Be confident, friendly, and slightly witty.
3. **Truthful**: Do NOT invent details. Stick STRICTLY to the profile below.
4. **Plain Text Only**: Output clean Markdown. NO JSON blobs.
5. **No Slogans**: Avoid "Systems over Chaos".

*** ESTIVAN'S PROFILE (TRUTH MAP) ***
- **Name**: Estivan Ayramia (He/Him). El Cajon, CA (San Diego).
- **Origin**: Born Jan 21, 2004 (Baghdad/Syria).
- **Education**: SDSU, General Business.
- **Experience**:
  - **Coaching**: 3 years coaching middle/high school students (Communication & Leadership).
  - **Operations**: Focused on Supply Chain, Logistics, Project Execution.
- **Key Projects**:
  - **Logistics System**: Automated supply chain flows.
  - **Conflict Playbook**: Workplace safety & de-escalation.
  - **getWispers (Whispers)**: Anonymous messaging app (focus on ethics/moderation).
  - **Discipline System**: Consistency tracking.
- **Hobbies & Interests**:
  - **Cars**: Drives a BMW 540i (V8). Does his own maintenance.
  - **Reading**: Favorite book is "The 48 Laws of Power".
  - **Cooking**: Makes a mean steak.
  - **Gym**: Value discipline and consistency.

*** LINKS ***
Use these markdown links naturally in your sentences:
- [Overview](/overview.html)
- [Projects](/projects.html)
- [Contact](/contact.html)
- [Resume](/assets/docs/Estivan-Ayramia-Resume.pdf)

*** GREETING STRATEGY ***
If user says "hi"/"hello":
- Say a quick friendly hello.
- Ask how you can help (e.g., "Want to see my projects or grab my resume?").
- Do NOT dump the full bio.

PAGE CONTEXT: ${pageContent || "Home"}
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

        // If Gemini returns any structured error, retry once with a fallback model.
        if (data?.error) {
          console.log("Gemini call error", {
            code: data.error.code,
            status: data.error.status || null,
            model: cachedModel,
            msgLen: userMessage.length
          });

          if (!String(cachedModel).includes("pro")) {
            cachedModel = "models/gemini-1.5-pro";
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

      } catch (err) {
        console.error("Gemini processing error:", err.message);
        
        if (err.message.includes('timeout')) {
          return jsonReply(
            { errorType: "Timeout", reply: "I'm thinking too hard! Shorten your question?", chips: ["Resume", "Contact"] },
            504, corsHeaders
          );
        }
        
        return jsonReply(
          {
            errorType: null,
            reply: "The AI service is busy right now. You can still browse [Projects](/projects.html), open the [Resume](/assets/docs/Estivan-Ayramia-Resume.pdf), or use [Contact](/contact.html).",
            chips: ["Projects", "Resume", "Contact"],
            truncated: false,
            continuation_hint: null,
            reply_length: 0,
            action: null,
            card: null
          },
          200,
          corsHeaders
        );
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
          502, corsHeaders
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

      return jsonReply(
        {
          errorType: null,
          reply: sanitizedReply,
          chips: buildChips(lowerMsg),
          truncated: isTruncated,
          continuation_hint: isTruncated ? sanitizedReply.slice(-1000) : null,
          reply_length: sanitizedReply.length,
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
async function callGemini(modelName, context, userMessage, apiKey, maxTokens = 500) {
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

  if (!resp.ok && !json.error) {
    json.error = {
      code: resp.status,
      message: `HTTP ${resp.status} from Gemini`
    };
  }

  return json;
}