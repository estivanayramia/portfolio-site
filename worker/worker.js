// ============================================================================
// SAVONIE AI - ESTIVAN'S PORTFOLIO CHATBOT (PERFECTED v2)
// Cloudflare Worker with Structured "Public Brain" & JSON Enforcement
// ============================================================================

let cachedModel = "models/gemini-1.5-flash";
const GEMINI_TIMEOUT = 25000;
const MAX_MESSAGE_LENGTH = 2000;
const VERSION_TAG = "v2026.01.12-savonie-perfected";

// --- FACTS & TRUTH MAP (The "Public Brain") ---
// Defined as a const to be injected into the system prompt.
const ESTIVAN_PROFILE = {
  identity: {
    name: "Estivan Ayramia",
    pronouns: "He/Him",
    location: "El Cajon, CA (San Diego area) since 2008",
    origin: "Born Jan 21, 2004 in Baghdad. Lived in Syria before moving to US.",
    education: "General Business graduate from San Diego State University (SDSU), Dec 2025.",
    role_target: "Operations, Supply Chain, Logistics, or Project Execution roles.",
    languages: ["English (Native/Fluent)", "Chaldean (Spoken)", "Arabic (Conversational)", "Spanish (Conversational)"],
    teaching_experience: "3 years coaching middle/high school students (Communication & Leadership)."
  },
  voice_guidelines: [
    "You are Savonie, a helpful portfolio assistant.",
    "Speak in the third person (e.g., 'Estivan is...', 'He built...').",
    "Switch to first person ONLY if specifically asked 'tell me in his voice'.",
    "Be concise, confident, and slightly witty. No corporate jargon or slogans.",
    "Do NOT answer questions about health, family drama, or sensitive private topics.",
    "If uncertain, push for the 'Contact' action."
  ],
  projects: [
    {
      id: "logistics",
      name: "Logistics System",
      desc: "Automated supply chain operations to improve delivery times. Focus on execution and systems.",
      url: "/project-logistics.html"
    },
    {
      id: "conflict",
      name: "Conflict Playbook",
      desc: "Standardized de-escalation protocols for workplace safety. A practical framework for navigating conflict.",
      url: "/project-conflict.html"
    },
    {
      id: "discipline",
      name: "Discipline System",
      desc: "A routine and mindset system for sustainable consistency.",
      url: "/project-discipline.html"
    },
    {
      id: "whispers",
      name: "getWispers (Whispers)",
      desc: "Anonymous messaging app focused on ethics and moderation.",
      url: "/projects/whispers.html"
    },
    {
      id: "website",
      name: "Portfolio PWA",
      desc: "This website! Built for speed and clarity using vanilla JS and Cloudflare.",
      url: "/"
    }
  ],
  hobbies: ["Gym (discipline/consistency)", "Cars (Restores/Maintains BMW 540i V8)", "Reading ('The 48 Laws of Power')", "Cooking (Steaks)"]
};

// --- SYSTEM PROMPT ---
// Enforces the JSON schema your frontend expects.
const SYSTEM_INSTRUCTIONS = `
You are Savonie AI. Your goal is to convert visitors into contacts for Estivan Ayramia.
Today is: ${new Date().toLocaleDateString("en-US")}

*** YOUR KNOWLEDGE BASE ***
${JSON.stringify(ESTIVAN_PROFILE, null, 2)}

*** CRITICAL OUTPUT RULE ***
You must ALWAYS respond with a valid JSON object. Do not include markdown formatting (like \`\`\`json) outside the object.
The schema is:
{
  "reply": "Your text response here (markdown allowed inside string).",
  "chips": ["Short Follow-up 1", "Short Follow-up 2", "Short Follow-up 3"],
  "action": "download_resume" | "email_link" | "open_linkedin" | null,
  "card": "logistics" | "conflict" | "discipline" | "website" | "whispers" | null
}

*** LOGIC & BEHAVIOR ***
1. **Resume Requests:** If user asks for CV/Resume, set "action": "download_resume".
2. **Contact/Hire:** If user wants to email or hire, set "action": "email_link".
3. **Project Specifics:** If user asks about a specific project (e.g., "logistics"), set "card": "logistics".
4. **General Questions:** Answer from the Knowledge Base. Keep "reply" short (2-3 sentences max).
5. **Unknowns:** If the answer isn't in the profile, say "I don't have that detail, but you can ask him directly!" and set "action": "email_link".
6. **Chips:** Always provide 2-3 relevant follow-up options in "chips".

*** EXAMPLES ***
User: "Hi"
Output: { "reply": "Hello! I'm Savonie. Want to see Estivan's projects or grab his resume?", "chips": ["View Projects", "Download Resume", "Contact"], "action": null, "card": null }

User: "Download his resume"
Output: { "reply": "Here is the PDF resume. Let me know if you need anything else!", "chips": ["View Projects", "Contact"], "action": "download_resume", "card": null }
`;

// Rate limiter helper
const localRateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60000; 
const RATE_LIMIT_MAX = 20;

function checkLocalRateLimit(clientIP) {
  const key = `ip:${clientIP}`;
  const now = Date.now();
  const record = localRateLimiter.get(key);
  if (!record || (now - record.startTime > RATE_LIMIT_WINDOW)) {
    localRateLimiter.set(key, { count: 1, startTime: now });
    return true;
  }
  record.count++;
  return record.count <= RATE_LIMIT_MAX;
}

// Helper to sanitize response
function cleanJsonResponse(text) {
  // Remove markdown code fences if present
  let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
  // Attempt to find the first '{' and last '}'
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    return clean.substring(start, end + 1);
  }
  return clean;
}

// CORS Headers
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = [
    "https://estivanayramia.com",
    "https://www.estivanayramia.com",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
  ];
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function jsonReply(body, status, corsHeaders) {
  return new Response(JSON.stringify({ ...body, version: VERSION_TAG }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

// Fetch with Timeout
async function fetchWithTimeout(url, options, timeout = 25000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// --- WORKER HANDLER ---
export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "POST") return jsonReply({ error: "Method not allowed" }, 405, corsHeaders);

    try {
      const { message, language } = await request.json();
      if (!message) return jsonReply({ error: "No message" }, 400, corsHeaders);

      // Rate Limit
      const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
      if (env.RATE_LIMITER) {
        try {
          const { success } = await env.RATE_LIMITER.limit({ key: `ip:${clientIP}` });
          if (!success) return jsonReply({ errorType: "RateLimit", reply: "Too fast! Give me a second." }, 429, corsHeaders);
        } catch(e) {}
      } else if (!checkLocalRateLimit(clientIP)) {
        return jsonReply({ errorType: "RateLimit", reply: "Too fast! Give me a second." }, 429, corsHeaders);
      }

      // Check API Key
      if (!env.GEMINI_API_KEY) return jsonReply({ errorType: "ConfigError", reply: "System offline (Config)." }, 503, corsHeaders);

      // Call Gemini
      const url = `https://generativelanguage.googleapis.com/v1beta/${cachedModel}:generateContent?key=${env.GEMINI_API_KEY}`;
      const payload = {
        contents: [{ parts: [{ text: `${SYSTEM_INSTRUCTIONS}\n\nUser Input: "${message}"\nUser Language: ${language || "en"}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500, responseMimeType: "application/json" }
      };

      const aiRes = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const aiJson = await aiRes.json();
      
      // Extract text
      let rawText = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error("Empty AI response");

      // Parse AI JSON
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(cleanJsonResponse(rawText));
      } catch (e) {
        console.error("JSON Parse Fail:", rawText);
        // Fallback if AI fails to format JSON
        parsedResponse = {
          reply: "I'm thinking, but got a bit confused. Try asking about the Projects?",
          chips: ["Projects", "Resume", "Contact"],
          action: null,
          card: null
        };
      }

      return jsonReply(parsedResponse, 200, corsHeaders);

    } catch (e) {
      console.error(e);
      return jsonReply({ 
        errorType: "SystemError", 
        reply: "I'm having a temporary brain freeze. Try refreshing?", 
        chips: ["Projects", "Contact"] 
      }, 500, corsHeaders);
    }
  }
};
