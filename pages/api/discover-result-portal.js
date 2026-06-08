import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import {
  derivePortalUrls,
  findResultPortalCandidates
} from "../../lib/resultDiscovery";
import { logEvent } from "../../lib/logger";
import { sendTelegramMessage } from "../../lib/telegram";
import { sendWhatsAppResultAlertToAdmins } from "../../lib/whatsapp";
import {
  OFFICIAL_MAIN_PORTAL,
  validateResultLink,
  validateDirectResultForms,
  deriveStableResultLinksFromDetectedUrl,
  buildResultInstruction
} from "../../lib/resultLinkValidator";

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
    hay.includes("nep_result.aspx") ||
    hay.includes("pg_nep_result.aspx");

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

function getValidDirectFormsText(directFormValidations = []) {
  const validForms = directFormValidations.filter((item) => item.valid);

  if (!validForms.length) return "";

  return validForms
    .map((item) => `${item.label}:\n${item.url}`)
    .join("\n\n");
}

function buildPlainShareMessage({
  top,
  displayUrl,
  originalUrl,
  validatedLink,
  directLinks,
  directFormValidations
}) {
  const instruction = buildResultInstruction(validatedLink, directLinks);
  const validFormsText = getValidDirectFormsText(directFormValidations);

  return [
    "PDUSU Result 2025-26 Portal Detected",
    "",
    `Title: ${top.label || "Result 2025-26"}`,
    "",
    `Official Main Portal: ${OFFICIAL_MAIN_PORTAL}`,
    "",
    validFormsText ? `Direct Result Links:\n${validFormsText}` : "",
    "",
    `Safe Public Link: ${displayUrl}`,
    validatedLink?.valid ? "" : "Note: Direct session result link may expire, so use the official exam portal or stable direct result links.",
    "",
    instruction,
    "",
    originalUrl && originalUrl !== displayUrl
      ? `Detected Session Link: ${originalUrl}`
      : "",
    "Source: Official University Result Portal"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildTelegramAlert({
  top,
  displayUrl,
  originalUrl,
  validatedLink,
  directLinks,
  directFormValidations
}) {
  const instruction = buildResultInstruction(validatedLink, directLinks);
  const validFormsText = getValidDirectFormsText(directFormValidations);

  const plain = buildPlainShareMessage({
    top,
    displayUrl,
    originalUrl,
    validatedLink,
    directLinks,
    directFormValidations
  });

  const shareLink = buildWhatsAppShareLink(plain);

  return [
    "🎓 <b>PDUSU Result 2025-26 Portal Detected</b>",
    "",
    "University ki official exam site par 2025-26 result portal/link detect hua hai.",
    "",
    `<b>Title:</b> ${top.label || "Result 2025-26"}`,
    "",
    "<b>Official Main Portal:</b>",
    OFFICIAL_MAIN_PORTAL,
    "",
    validFormsText ? `<b>Direct Result Links:</b>\n${validFormsText}` : "",
    "",
    "<b>Safe Public Link:</b>",
    displayUrl,
    "",
    validatedLink?.valid
      ? ""
      : "⚠️ Direct session link expire/server error de sakta hai. Isliye safe official portal/stable direct links share kiye gaye hain.",
    "",
    "<b>Instruction:</b>",
    instruction,
    "",
    originalUrl && originalUrl !== displayUrl
      ? `<b>Detected Session Link:</b>\n${originalUrl}`
      : "",
    "",
    "<b>WhatsApp Share:</b>",
    shareLink,
    "",
    "Source: Official University Result Portal"
  ]
    .filter(Boolean)
    .join("\n");
}

function makeAlertId(targetYear, urls) {
  return `result_portal_alert_${targetYear.replace(
    /[^a-z0-9]/gi,
    "_"
  )}_${urls.activeResultBaseUrl.replace(/[^a-z0-9]/gi, "_")}`;
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

    let urls = null;
    let directLinks = null;
    let directFormValidations = [];
    let validatedLink = null;
    let displayUrl = OFFICIAL_MAIN_PORTAL;
    let telegramSent = false;
    let telegramMessageId = null;
    let whatsapp = null;
    let alertAlreadySent = false;

    if (top) {
      urls = derivePortalUrls(top.href);
      directLinks = deriveStableResultLinksFromDetectedUrl(top.href);

      validatedLink = await validateResultLink(top.href);
      directFormValidations = await validateDirectResultForms();

      const validDirectForms = directFormValidations.filter((item) => item.valid);

      if (validDirectForms.length) {
        displayUrl = validDirectForms[0].url;
      } else {
        displayUrl = validatedLink.valid ? validatedLink.safeUrl : OFFICIAL_MAIN_PORTAL;
      }

      update.activeResultBaseUrl = urls.activeResultBaseUrl;
      update.activeResultsPageUrl = urls.activeResultsPageUrl;
      update.activeNepResultUrl = urls.activeNepResultUrl;
      update.detectedResultUrl = top.href;
      update.safePublicResultUrl = displayUrl;

      update.directLinks = directLinks;
      update.ugNepResultUrl = directLinks.ugNepResultUrl;
      update.pgNepResultUrl = directLinks.pgNepResultUrl;
      update.officialMainPortal = OFFICIAL_MAIN_PORTAL;

      update.resultLinkValidation = validatedLink;
      update.directFormValidations = directFormValidations;
      update.status = "portal_found";

      if (old.activeResultBaseUrl !== urls.activeResultBaseUrl) {
        update.lastFoundAt = FieldValue.serverTimestamp();
      }
    } else {
      update.status = "discovering";
      update.activeResultBaseUrl = old.activeResultBaseUrl || "";
      update.activeResultsPageUrl = old.activeResultsPageUrl || "";
      update.activeNepResultUrl = old.activeNepResultUrl || "";
      update.safePublicResultUrl = old.safePublicResultUrl || OFFICIAL_MAIN_PORTAL;
      update.officialMainPortal = OFFICIAL_MAIN_PORTAL;
      update.directLinks = old.directLinks || {};
      update.ugNepResultUrl = old.ugNepResultUrl || "";
      update.pgNepResultUrl = old.pgNepResultUrl || "";
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
        currentYearCandidates: currentYearCandidates.length,
        validatedLink,
        directLinks,
        directFormValidations,
        displayUrl
      }
    );

    if (top && urls) {
      const alertId = makeAlertId(targetYear, urls);
      const alertRef = db.collection("result_seen_events").doc(alertId);
      const alertSnap = await alertRef.get();

      if (alertSnap.exists && alertSnap.data()?.sent) {
        alertAlreadySent = true;
      } else {
        const telegramText = buildTelegramAlert({
          top,
          displayUrl,
          originalUrl: top.href,
          validatedLink,
          directLinks,
          directFormValidations
        });

        const telegram = await sendTelegramMessage({
          chatId: process.env.TELEGRAM_PUBLIC_CHAT_ID,
          text: telegramText
        });

        telegramSent = true;
        telegramMessageId = telegram?.message_id || null;

        try {
          whatsapp = await sendWhatsAppResultAlertToAdmins({
            title: "PDUSU Result 2025-26",
            link: displayUrl
          });
        } catch (err) {
          whatsapp = {
            success: false,
            error: err.message
          };
        }

        await alertRef.set(
          {
            type: "result_portal_public_alert",
            targetYear,
            href: top.href,
            label: top.label || "",
            urls,
            directLinks,
            displayUrl,
            validatedLink,
            directFormValidations,
            telegramSent,
            telegramMessageId,
            whatsapp,
            sent: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

        await logEvent(
          "portal_discovery",
          "warn",
          "Public result portal alert sent",
          {
            href: top.href,
            label: top.label,
            urls,
            directLinks,
            displayUrl,
            validatedLink,
            directFormValidations,
            telegramMessageId,
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
      displayUrl,
      directLinks,
      directFormValidations,
      validatedLink,
      alertAlreadySent,
      telegramSent,
      telegramMessageId,
      whatsapp
    });
  } catch (err) {
    await logEvent("portal_discovery", "error", err.message, {});
    return safeJsonError(res, err);
  }
}
