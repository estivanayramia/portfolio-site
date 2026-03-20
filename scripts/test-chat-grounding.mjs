#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import worker from "../worker/worker.mjs";
import { buildModelContext, prepareChatContext, hasBannedLanguage } from "../worker/chat-service.mjs";

const ROOT_DIR = process.cwd();
const PROFILE = JSON.parse(readFileSync(path.join(ROOT_DIR, "data", "chat", "estivan-profile.public.json"), "utf8"));
const SITE_FACTS = JSON.parse(readFileSync(path.join(ROOT_DIR, "assets", "data", "site-facts.json"), "utf8"));
const PAGE_MANIFEST = JSON.parse(readFileSync(path.join(ROOT_DIR, "assets", "data", "chat-page-manifest.json"), "utf8"));

let passed = 0;
let failed = 0;

function logResult(ok, label, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`PASS ${label}`);
    return;
  }

  failed += 1;
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

function baseEnv(overrides = {}) {
  return {
    SITE_BASE_URL: "https://www.estivanayramia.com",
    __TEST_DISABLE_RATE_LIMIT: true,
    __CHAT_PROFILE: PROFILE,
    __SITE_FACTS: SITE_FACTS,
    __PAGE_MANIFEST: PAGE_MANIFEST,
    ...overrides
  };
}

async function ask(message, env = baseEnv(), pageContext = {}) {
  const request = new Request("https://www.estivanayramia.com/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      language: "en",
      pageContext: {
        route: "/",
        title: "Home",
        buildVersion: PAGE_MANIFEST.buildVersion || "",
        headings: [],
        ...pageContext
      }
    })
  });

  const response = await worker.fetch(request, env);
  const data = await response.json();
  return {
    status: response.status,
    data
  };
}

function assertReplyContains(reply, parts) {
  const lower = String(reply || "").toLowerCase();
  for (const part of parts) {
    assert.ok(lower.includes(part.toLowerCase()), `expected "${part}" in "${reply}"`);
  }
}

function assertReplyNotContains(reply, parts) {
  const lower = String(reply || "").toLowerCase();
  for (const part of parts) {
    assert.ok(!lower.includes(part.toLowerCase()), `did not expect "${part}" in "${reply}"`);
  }
}

function assertReplyUsesThirdPerson(reply) {
  assert.ok(!/\b(i|i'm|i’ve|i'd|my|me|mine)\b/i.test(String(reply || "")), `expected third-person reply but got "${reply}"`);
}

async function testSurfaceFacts() {
  const prompts = [
    ["What is your favorite color?", ["brown", "beige", "cream"]],
    ["What is your favorite movie?", ["iron man"]],
    ["What is your favorite book?", ["how to win friends"]],
    ["What is your favorite team?", ["barcelona"]],
    ["What do you drink the most?", ["water", "coke zero"]],
    ["What languages do you speak?", ["arabic", "chaldean", "english", "spanish"]],
    ["Where are you from?", ["baghdad", "el cajon"]],
    ["How tall are you?", ["5'10"]],
    ["When is your birthday?", ["january 21, 2004"]],
    ["What is your style like?", ["dunks", "jordan 1s", "air forces"]]
  ];

  for (const [message, expected] of prompts) {
    const result = await ask(message);
    assert.equal(result.status, 200);
    assertReplyContains(result.data.reply, expected);
    assert.ok(!hasBannedLanguage(result.data.reply));
    assertReplyUsesThirdPerson(result.data.reply);
  }
}

async function testRecruiterQuestions() {
  const recruiterChecks = [
    ["Why hire him over someone with more experience?", ["experience matters", "learning speed", "useful quickly"]],
    ["Is this mostly AI doing the work?", ["he used ai", "judgment", "/projects/portfolio"]],
    ["What is he like on a team?", ["adaptable", "respectful", "lead or support"]],
    ["What roles fit him best?", ["operations", "project coordination"]],
    ["What are his weaknesses?", ["gaps", "keep moving"]]
  ];

  for (const [message, expected] of recruiterChecks) {
    const result = await ask(message);
    assert.equal(result.status, 200);
    assertReplyContains(result.data.reply, expected);
    assert.ok(!hasBannedLanguage(result.data.reply));
    assertReplyUsesThirdPerson(result.data.reply);
  }
}

async function testShallowQuestionHandling() {
  const result = await ask("So what's he about?");
  assert.equal(result.status, 200);
  assertReplyContains(result.data.reply, ["people", "process", "doing the work right"]);
  assertReplyUsesThirdPerson(result.data.reply);
}

async function testBoundaryHandling() {
  const result = await ask("Does he have a girlfriend?");
  assert.equal(result.status, 200);
  assertReplyContains(result.data.reply, ["off the public version", "work", "site"]);
  assertReplyUsesThirdPerson(result.data.reply);
}

async function testUnknownHandling() {
  const result = await ask("What is his exact SAT score?");
  assert.equal(result.status, 200);
  assertReplyContains(result.data.reply, ["better answered by estivan directly", "/contact"]);
  assertReplyNotContains(result.data.reply, ["1600", "1550", "1490"]);
  assert.equal(result.data.debug?.questionClass || "unknown", "unknown");
  assertReplyUsesThirdPerson(result.data.reply);
}

async function testPageSpecificHandling() {
  const result = await ask("Tell me about the Endpoint playbook");
  assert.equal(result.status, 200);
  assertReplyContains(result.data.reply, ["endpoint competitive playbook", "/projects/endpoint-competitive-playbook"]);
  assertReplyUsesThirdPerson(result.data.reply);

  const grimesResult = await ask("What is the Isa Grimes interview project about?");
  assert.equal(grimesResult.status, 200);
  assertReplyContains(grimesResult.data.reply, ["isa grimes interview", "/projects/isa-grimes-interview"]);
  assertReplyUsesThirdPerson(grimesResult.data.reply);
}

async function testProjectFactsIntegrity() {
  assert.equal(SITE_FACTS.meta?.projectCount, 7);
  assert.ok(SITE_FACTS.projects.some((project) => project.url === "/projects/isa-grimes-interview"));
  assert.ok(PAGE_MANIFEST.pages.some((page) => page.route === "/projects/isa-grimes-interview"));
}

async function testFreshnessRefresh() {
  const staleManifest = {
    ...PAGE_MANIFEST,
    buildVersion: "old-build"
  };

  const originalFetch = global.fetch;
  global.fetch = async (input) => {
    const url = typeof input === "string" ? input : input.url;
    const pathname = new URL(url).pathname;

    if (pathname === "/overview") {
      return new Response(`<!DOCTYPE html>
        <html lang="en">
          <head>
            <title>Overview | Estivan Ayramia</title>
            <meta name="description" content="Fresh runtime copy wins.">
            <meta name="build-version" content="fresh-build">
            <link rel="canonical" href="https://www.estivanayramia.com/overview">
          </head>
          <body>
            <main>
              <section>
                <h1>Overview</h1>
                <p>Fresh runtime copy wins.</p>
                <h2>Reliability</h2>
                <p>He stays on the work and cleans up after it.</p>
              </section>
            </main>
          </body>
        </html>`, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8"
        }
      });
    }

    return new Response("Not found", { status: 404 });
  };

  try {
    const result = await ask(
      "What does the overview page say about reliability?",
      baseEnv({ __PAGE_MANIFEST: staleManifest }),
      {
        route: "/overview",
        title: "Overview",
        buildVersion: "fresh-build"
      }
    );

    assert.equal(result.status, 200);
    assertReplyContains(result.data.reply, ["fresh runtime copy wins", "reliability"]);
    assert.equal(result.data.manifestStatus, "runtime_live_refresh");
    assertReplyUsesThirdPerson(result.data.reply);
  } finally {
    global.fetch = originalFetch;
  }
}

async function testPromptAndOutputAudit() {
  const context = await prepareChatContext({
    env: baseEnv(),
    request: new Request("https://www.estivanayramia.com/api/chat", { method: "POST" }),
    message: "Why hire him over someone with more experience?",
    language: "en",
    rawPageContext: {
      route: "/",
      title: "Home",
      buildVersion: PAGE_MANIFEST.buildVersion || ""
    },
    legacyPageContent: ""
  });

  const prompt = buildModelContext({
    message: "Why hire him over someone with more experience?",
    language: "en",
    pageContext: context.pageContext,
    profile: context.profile,
    siteFacts: context.siteFacts,
    retrieval: context.retrieval,
    questionClass: context.questionClass,
    register: context.register,
    manifestStatus: context.manifestStatus
  });

  assert.ok(!/passionate about|dynamic professional|results-driven|leveraging|innovative thinker/i.test(prompt));

  const replies = [
    (await ask("Why hire him over someone with more experience?")).data.reply,
    (await ask("Is this mostly AI doing the work?")).data.reply,
    (await ask("So what's he about?")).data.reply
  ];

  for (const reply of replies) {
    assert.ok(!hasBannedLanguage(reply));
  }
}

const tests = [
  ["Surface facts", testSurfaceFacts],
  ["Recruiter questions", testRecruiterQuestions],
  ["Shallow question handling", testShallowQuestionHandling],
  ["Boundary handling", testBoundaryHandling],
  ["Unknown handling", testUnknownHandling],
  ["Page-specific handling", testPageSpecificHandling],
  ["Project facts integrity", testProjectFactsIntegrity],
  ["Freshness refresh", testFreshnessRefresh],
  ["Prompt/output audit", testPromptAndOutputAudit]
];

for (const [label, fn] of tests) {
  try {
    await fn();
    logResult(true, label);
  } catch (error) {
    logResult(false, label, error.message);
  }
}

console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
