import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import {
  derivePortalUrls,
  findResultPortalCandidates
} from "../../lib/resultDiscovery";
import { logEvent } from "../../lib/logger";
import { sendTelegramMessage } from "../../lib/telegram";

function isCurrentYearResultCandidate(candidate, targetYear) {
  if (!candidate) return false;

  const hay = `${candidate.href || ""} ${candidate.label || ""}`.toLowerCase();
  const year = String(targetYear || "").toLowerCase();

  const hasCurrentYear =
    hay.includes(year) ||
    hay.includes("2025-26") ||
    hay.includes("result26") ||
    hay.includes("results-2025-26") ||
    hay.includes("result-2025-26") ||
    hay.includes("result -2025-26");

  const hasResultSignal =
    hay.includes("result") ||
    hay.includes("results.aspx") ||
    hay.includes("nep_result.aspx");

  const oldYear =
    hay.includes("2024-25") ||
    hay.includes("2023-24") ||
    hay.includes("2022-23") ||
    hay.includes("2021-22") ||
    hay.includes("result25") ||
    hay.includes("result24") ||
    hay.includes("result23") ||
    hay.includes("result22");

  return hasCurrentYear && hasResultSignal && !oldYear;
}

export default async function handler(req, res) {
  try {
    requireCron(req);

    const mainPortalUrl =
      process.env.MAIN_EXAM_PORTAL || "https://shekhauniexam.in/";
    const targetYear = process.env.TARGET_RESULT_YEAR || "2025-26";

    const response = await fetch(mainPortalUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 ApniLibraryResultAlert/1.0"
      }
    });

    const html = await response.text();

    const candidates = findResultPortalCandidates(
      html,
      mainPortalUrl,
      targetYear
    );

    const currentYearCandidates = candidates.filter((candidate) =>
      isCurrentYearResultCandidate(candidate, targetYear)
    );

    const top = currentYearCandidates[0] || null;

    const sourceRef = db.collection("result_sources").doc("pdusu_main");
    const sourceSnap = await sourceRef.get();
    const old = sourceSnap.exists ? sourceSnap.data() : {};

    const update = {
      mainPortalUrl,
      targetYear,
      candidates: candidates.slice(0, 20),
      currentYearCandidates: currentYearCandidates.slice(0, 10),
      lastCheckedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    let newlyFound = false;

    if (top) {
      const urls = derivePortalUrls(top.href);

      update.activeResultBaseUrl = urls.activeResultBaseUrl;
      update.activeResultsPageUrl = urls.activeResultsPageUrl;
      update.activeNepResultUrl = urls.activeNepResultUrl;
      update.status = "portal_found";

      if (old.activeResultBaseUrl !== urls.activeResultBaseUrl) {
        newlyFound = true;
        update.lastFoundAt = FieldValue.serverTimestamp();
      }
    } else {
      update.status = "discovering";
      update.activeResultBaseUrl = old.activeResultBaseUrl || "";
      update.activeResultsPageUrl = old.activeResultsPageUrl || "";
      update.activeNepResultUrl = old.activeNepResultUrl || "";
    }

    await sourceRef.set(update, {
      merge: true
    });

    await logEvent(
      "portal_discovery",
      "info",
      top
        ? "Current year result portal found"
        : "No current year result portal found yet",
      {
        top,
        totalCandidates: candidates.length,
        currentYearCandidates: currentYearCandidates.length
      }
    );

    if (newlyFound) {
      await sendTelegramMessage({
        chatId:
          process.env.TELEGRAM_ADMIN_CHAT_ID ||
          process.env.TELEGRAM_PUBLIC_CHAT_ID,
        text: `⚠️ <b>New 2025-26 result portal detected</b>\n\n${top.href}\n\nLabel: ${
          top.label || "N/A"
        }\nScore: ${top.score}\n\nPlease verify in admin panel.`
      });
    }

    return res.status(200).json({
      success: true,
      status: update.status,
      top,
      currentYearCandidates: currentYearCandidates.slice(0, 10),
      candidates: candidates.slice(0, 10)
    });
  } catch (err) {
    await logEvent("portal_discovery", "error", err.message, {});
    return safeJsonError(res, err);
  }
}
