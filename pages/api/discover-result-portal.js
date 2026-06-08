import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import {
  derivePortalUrls,
  findResultPortalCandidates
} from "../../lib/resultDiscovery";
import { logEvent } from "../../lib/logger";
import { sendTelegramMessage } from "../../lib/telegram";
import { sendWhatsAppResultAlertToAdmins } from "../../lib/whatsapp";

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

  const blocked =
    hay.includes("practical") ||
    hay.includes("admit card") ||
    hay.includes("login.aspx") ||
    hay.includes("marks entry") ||
    hay.includes("exam form");

  return hasCurrentYear && hasResultSignal && !oldYear && !blocked;
}

function buildWhatsAppShareLink(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function buildPlainShareMessage(top, urls) {
  return [
    "PDUSU Result 2025-26 Portal Detected",
    "",
    `Title: ${top.label || "Result 2025-26"}`,
    "",
    `Official Link: ${top.href}`,
    urls?.activeResultsPageUrl ? `Result List: ${urls.activeResultsPageUrl}` : "",
    urls?.activeNepResultUrl ? `NEP Result Form: ${urls.activeNepResultUrl}` : "",
    "",
    "Students official portal par apna roll number check karein.",
    "Source: Official University Result Portal"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildTelegramAlert(top, urls) {
  const plain = buildPlainShareMessage(top, urls);
  const shareLink = buildWhatsAppShareLink(plain);

  return [
    "🎓 <b>PDUSU Result 2025-26 Portal Detected</b>",
    "",
    "University ki official exam site par 2025-26 result portal/link detect hua hai.",
    "",
    `<b>Title:</b> ${top.label || "Result 2025-26"}`,
    "",
    `<b>Open Official Result Link:</b>`,
    top.href,
    "",
    urls?.activeResultsPageUrl
      ? `<b>Result List Page:</b>\n${urls.activeResultsPageUrl}`
      : "",
    urls?.activeNepResultUrl
      ? `\n<b>NEP Result Form:</b>\n${urls.activeNepResultUrl}`
      : "",
    "",
    `<b>WhatsApp Share:</b>`,
    shareLink,
    "",
    "Students apna roll number official portal par check karein.",
    "",
    "Source: Official University Result Portal"
  ]
    .filter(Boolean)
    .join("\n");
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
    let urls = null;

    if (top) {
      urls = derivePortalUrls(top.href);

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

    let whatsapp = null;

    if (newlyFound && top && urls) {
      const alertId = `result_portal_alert_${targetYear.replace(
        /[^a-z0-9]/gi,
        "_"
      )}_${urls.activeResultBaseUrl.replace(/[^a-z0-9]/gi, "_")}`;

      const alertRef = db.collection("result_seen_events").doc(alertId);
      const alertSnap = await alertRef.get();

      if (!alertSnap.exists) {
        const msg = buildTelegramAlert(top, urls);

        await sendTelegramMessage({
          chatId: process.env.TELEGRAM_PUBLIC_CHAT_ID,
          text: msg
        });

        try {
          whatsapp = await sendWhatsAppResultAlertToAdmins({
            title: "PDUSU Result 2025-26",
            link: top.href
          });
        } catch (err) {
          whatsapp = {
            success: false,
            error: err.message
          };
        }

        await alertRef.set({
          type: "result_portal_public_alert",
          targetYear,
          href: top.href,
          label: top.label || "",
          urls,
          telegramSent: true,
          whatsapp,
          sent: true,
          createdAt: FieldValue.serverTimestamp()
        });

        await logEvent(
          "portal_discovery",
          "warn",
          "Public result portal alert sent",
          {
            href: top.href,
            label: top.label,
            urls,
            whatsapp
          }
        );
      }
    }

    return res.status(200).json({
      success: true,
      status: update.status,
      top,
      currentYearCandidates: currentYearCandidates.slice(0, 10),
      candidates: candidates.slice(0, 10),
      whatsapp
    });
  } catch (err) {
    await logEvent("portal_discovery", "error", err.message, {});
    return safeJsonError(res, err);
  }
}
