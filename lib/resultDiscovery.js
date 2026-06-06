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

  const targetYearLoose = targetYear.replace("-", "[- ]?");
  const pattern = new RegExp(
    `(result|results|nep|semester|${targetYearLoose}|2025|2026|result26|RESULTS\\.aspx|NEP_RESULT\\.aspx)`,
    "i"
  );

  for (const link of links) {
    const hay = `${link.href} ${link.label}`;

    if (pattern.test(hay)) {
      candidates.push({
        ...link,
        score: scoreCandidate(hay, targetYear)
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function scoreCandidate(text, targetYear) {
  const t = text.toLowerCase();

  let score = 0;

  if (t.includes("result")) score += 10;
  if (t.includes(targetYear.toLowerCase())) score += 15;
  if (t.includes("2025") || t.includes("2026")) score += 5;
  if (t.includes("result26")) score += 20;
  if (t.includes("results.aspx")) score += 15;
  if (t.includes("nep_result.aspx")) score += 15;
  if (t.includes("nep")) score += 5;

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
