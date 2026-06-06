import crypto from "crypto";
import { cleanText } from "./security";

export function hashText(text) {
  return crypto
    .createHash("sha256")
    .update(String(text || ""))
    .digest("hex");
}

export function absolutizeUrl(url, base) {
  try {
    return new URL(url, base).toString();
  } catch {
    return "";
  }
}

export function extractLinks(html, baseUrl) {
  const links = [];
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html))) {
    const href = absolutizeUrl(match[1], baseUrl);
    const label = cleanText(match[2].replace(/<[^>]*>/g, " "));

    if (href) {
      links.push({
        href,
        label
      });
    }
  }

  return links;
}

export function findResultPortalCandidates(
  html,
  baseUrl,
  targetYear = "2025-26"
) {
  const links = extractLinks(html, baseUrl);
  const candidates = [];

  for (const link of links) {
    const hay = `${link.href} ${link.label}`;
    const score = scoreCandidate(hay, targetYear);

    if (score > 0) {
      candidates.push({
        ...link,
        score
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function scoreCandidate(text, targetYear) {
  const t = String(text || "").toLowerCase();

  let score = 0;

  const blockedWords = [
    "practical",
    "marks entry",
    "login.aspx",
    "college login",
    "admit card",
    "admitcard",
    "download practical admit",
    "exam form",
    "apply online",
    "fee",
    "time table",
    "timetable"
  ];

  for (const word of blockedWords) {
    if (t.includes(word)) {
      score -= 100;
    }
  }

  const isResultWord =
    t.includes("result") ||
    t.includes("results") ||
    t.includes("result-") ||
    t.includes("results-");

  if (isResultWord) score += 30;

  if (t.includes(targetYear.toLowerCase())) score += 40;

  if (t.includes("2025-26")) score += 35;
  if (t.includes("2025")) score += 8;
  if (t.includes("2026")) score += 8;

  if (t.includes("result26")) score += 60;
  if (t.includes("result25")) score += 10;
  if (t.includes("result24")) score -= 5;
  if (t.includes("result23")) score -= 10;

  if (t.includes("results.aspx")) score += 35;
  if (t.includes("nep_result.aspx")) score += 35;

  if (t.includes("download results")) score += 20;
  if (t.includes("results-2025-26")) score += 70;
  if (t.includes("result -2025-26")) score += 70;
  if (t.includes("result-2025-26")) score += 70;

  if (!isResultWord && !t.includes("results.aspx") && !t.includes("nep_result.aspx")) {
    score -= 50;
  }

  return score;
}

export function derivePortalUrls(candidateUrl) {
  const url = new URL(candidateUrl);
  const base = `${url.protocol}//${url.host}/`;

  return {
    activeResultBaseUrl: base,
    activeResultsPageUrl: new URL("RESULTS.aspx", base).toString(),
    activeNepResultUrl: new URL("NEP_RESULT.aspx", base).toString()
  };
}
