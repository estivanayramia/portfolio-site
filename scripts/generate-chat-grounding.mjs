#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createPageRecord,
  normalizeRoute
} from "../worker/chat-grounding-utils.mjs";

const ROOT_DIR = process.cwd();
const BASE_URL = "https://www.estivanayramia.com";
const OUTPUT_PATH = path.join(ROOT_DIR, "assets", "data", "chat-page-manifest.json");

function listRelevantHtmlFiles() {
  const files = new Set();

  if (existsSync(path.join(ROOT_DIR, "index.html"))) {
    files.add("index.html");
  }

  const walk = (dirPath, prefix = "") => {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const entryPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath, entryPrefix);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
      if (entryPrefix === "EN/404.html") continue;
      if (entryPrefix.startsWith("EN/hobbies-games")) continue;
      if (entryPrefix === "EN/hobbies/index.html") continue;
      files.add(entryPrefix);
    }
  };

  for (const folder of ["EN", "ar", "es"]) {
    const absoluteDir = path.join(ROOT_DIR, folder);
    if (existsSync(absoluteDir)) {
      walk(absoluteDir, folder);
    }
  }

  return [...files].sort((left, right) => left.localeCompare(right));
}

function inferRouteFromFile(filePath) {
  if (filePath === "index.html") return "/";
  if (filePath === "ar/index.html") return "/ar/";
  if (filePath === "es/index.html") return "/es/";

  const trimmed = filePath.replace(/^EN\//, "").replace(/\\/g, "/");
  if (trimmed.endsWith("/index.html")) {
    return normalizeRoute(`/${trimmed.slice(0, -10)}/`);
  }
  return normalizeRoute(`/${trimmed.replace(/\.html$/, "")}`);
}

function sourceRank(filePath) {
  if (filePath === "index.html") return 0;
  if (filePath.startsWith("EN/")) return 1;
  return 2;
}

function chooseBuildVersion(pages) {
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

function buildRouteMap(files) {
  const routeMap = new Map();

  for (const filePath of files) {
    const absolutePath = path.join(ROOT_DIR, filePath);
    const html = readFileSync(absolutePath, "utf8");
    const page = createPageRecord({
      route: inferRouteFromFile(filePath),
      html,
      sourceFile: filePath
    });

    const existing = routeMap.get(page.route);
    if (!existing || sourceRank(filePath) < sourceRank(existing.sourceFile)) {
      routeMap.set(page.route, page);
    }
  }

  return routeMap;
}

function crawlRelevantPages(routeMap) {
  const queue = ["/", "/overview", "/deep-dive", "/about", "/projects/", "/contact", "/es/", "/ar/"];
  const visited = new Set();
  const pages = [];

  while (queue.length) {
    const route = normalizeRoute(queue.shift());
    if (!route || visited.has(route)) continue;
    visited.add(route);

    const page = routeMap.get(route);
    if (!page) continue;
    pages.push(page);

    for (const link of page.links || []) {
      if (link === "/hobbies/" || link === "/hobbies") {
        continue;
      }
      if (!visited.has(link) && routeMap.has(link)) {
        queue.push(link);
      }
    }
  }

  for (const page of routeMap.values()) {
    if (visited.has(page.route)) continue;
    if (
      page.pageType === "project_detail" ||
      page.pageType === "hobby_detail" ||
      page.pageType === "about_detail"
    ) {
      visited.add(page.route);
      pages.push(page);
    }
  }

  pages.sort((left, right) => left.route.localeCompare(right.route));
  return pages;
}

function buildManifest() {
  const files = listRelevantHtmlFiles();
  const routeMap = buildRouteMap(files);
  const pages = crawlRelevantPages(routeMap);

  return {
    version: "page-grounding-v1",
    source: "repo-crawl",
    baseUrl: BASE_URL,
    buildVersion: chooseBuildVersion(pages),
    pageCount: pages.length,
    pages
  };
}

function main() {
  const manifest = buildManifest();
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`[generate-chat-grounding] wrote ${manifest.pageCount} pages to ${OUTPUT_PATH}`);
  console.log(`[generate-chat-grounding] buildVersion=${manifest.buildVersion || "unknown"}`);
  for (const page of manifest.pages) {
    console.log(` - ${page.route} -> ${page.sourceFile}`);
  }
}

main();
