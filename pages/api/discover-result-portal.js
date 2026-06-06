import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import {
  derivePortalUrls,
  findResultPortalCandidates
} from "../../lib/resultDiscovery";
import { logEvent } from "../../lib/logger";
import { sendTelegramMessage } from "../../lib/telegram";

export default async function handler(req, res) {
  try {
    requireCron(req);

    const mainPortalUrl = process.env.MAIN_EXAM_PORTAL || "https://shekhauniexam.in/";
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

    const top = candidates[0] || null;

    const sourceRef = db.collection("result_sources").doc("pdusu_main");
    const sourceSnap = await sourceRef.get();
    const old = sourceSnap.exists ? sourceSnap.data() : {};

    const update = {
      mainPortalUrl,
      targetYear,
      candidates: candidates.slice(0, 20),
      status: top ? "candidate_found" : "discovering",
      lastCheckedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    let newlyFound = false;

    if (top && top.score >= 20) {
      const urls = derivePortalUrls(top.href);

      update.activeResultBaseUrl = urls.activeResultBaseUrl;
      update.activeResultsPageUrl = urls.activeResultsPageUrl;
      update.activeNepResultUrl = urls.activeNepResultUrl;
      update.status = "portal_found";

      if (old.activeResultBaseUrl !== urls.activeResultBaseUrl) {
        newlyFound = true;
        update.lastFoundAt = FieldValue.serverTimestamp();
      }
    }

    await sourceRef.set(update, {
      merge: true
    });

    await logEvent(
      "portal_discovery",
      "info",
      top ? "Result portal candidate found" : "No candidate found",
      {
        top,
        count: candidates.length
      }
    );

    if (newlyFound) {
      await sendTelegramMessage({
        chatId: process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_PUBLIC_CHAT_ID,
        text: `⚠️ <b>New result portal candidate detected</b>\n\n${top.href}\n\nLabel: ${
          top.label || "N/A"
        }\nScore: ${top.score}\n\nPlease verify in admin panel.`
      });
    }

    return res.status(200).json({
      success: true,
      status: update.status,
      top,
      candidates: candidates.slice(0, 10)
    });
  } catch (err) {
    await logEvent("portal_discovery", "error", err.message, {});
    return safeJsonError(res, err);
  }
}
