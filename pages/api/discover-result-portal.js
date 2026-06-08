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
  buildResultInstruction,
  getBestDisplayUrl
} from "../../lib/resultLinkValidator";

function cleanId(value) {
  return String(value || "")
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

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

function getValidDirectFormsText(directFormValidations = []) {
  const validForms = directFormValidations.filter((item) => item.valid);

  if (!validForms.length) return "";

  return validForms
    .map((item) => `${item.label}:\n${item.url}`)
    .join("\n\n");
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

  return [
    "🎓 <b>PDUSU Result 2025-26 Portal Detected</b>",
    "",
    "University ki official exam site par 2025-26 result portal/link detect hua hai.",
    "",
    `<b>Title:</b> ${top?.label || "Result 2025-26"}`,
    "",
    "<b>Official Main Portal:</b>",
    OFFICIAL_MAIN_PORTAL,
    "",
    validFormsText ? `<b>Direct Result Links:</b>\n${validFormsText}` : "",
    "",
    "<b>Safe Public Link:</b>",
    displayUrl,
    "",
    "<b>Instruction:</b>",
    instruction,
    "",
    originalUrl && originalUrl !== displayUrl
      ? `<b>Detected Session Link:</b>\n${originalUrl}`
      : "",
    "",
    "Source: Official University Result Portal"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildDirectFormTelegramAlert(form) {
  return [
    `🎓 <b>${form.alertTitle || form.label} Active</b>`,
    "",
    `${form.label} official result link active ho gaya hai.`,
    "",
    "<b>Direct Result Link:</b>",
    form.url,
    "",
    "<b>Official Main Portal:</b>",
    OFFICIAL_MAIN_PORTAL,
    "",
    "Students अपना course/semester select करके roll number से result check करें।",
    "अगर server slow/busy दिखे, तो कुछ मिनट बाद दोबारा try करें।",
    "",
    "Source: Official University Result Portal"
  ].join("\n");
}

function makePortalAlertId(targetYear, urls) {
  return `result_portal_alert_${cleanId(targetYear)}_${cleanId(
    urls?.activeResultBaseUrl || "unknown"
  )}`;
}

function makeDirectFormAlertId(targetYear, form) {
  return `result_direct_form_alert_${cleanId(targetYear)}_${cleanId(
    form.type
  )}_${cleanId(form.url)}`;
}

async function sendDirectFormAlert({
  targetYear,
  form,
  genericPortalAlertAlreadySent
}) {
  const alertId = makeDirectFormAlertId(targetYear, form);
  const alertRef = db.collection("result_seen_events").doc(alertId);
  const alertSnap = await alertRef.get();

  if (alertSnap.exists && alertSnap.data()?.sent) {
    return {
      type: form.type,
      label: form.label,
      url: form.url,
      sent: false,
      alreadySent: true,
      suppressed: false,
      telegramMessageId: alertSnap.data()?.telegramMessageId || null,
      whatsapp: alertSnap.data()?.whatsapp || null
    };
  }

  if (form.type === "PG_NEP" && genericPortalAlertAlreadySent) {
    await alertRef.set(
      {
        type: "result_direct_form_alert",
        formType: form.type,
        label: form.label,
        url: form.url,
        targetYear,
        sent: true,
        suppressed: true,
        reason: "pg_already_covered_by_old_portal_alert",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      {
        merge: true
      }
    );

    return {
      type: form.type,
      label: form.label,
      url: form.url,
      sent: false,
      alreadySent: false,
      suppressed: true,
      reason: "pg_already_covered_by_old_portal_alert",
      telegramMessageId: null,
      whatsapp: null
    };
  }

  const telegram = await sendTelegramMessage({
    chatId: process.env.TELEGRAM_PUBLIC_CHAT_ID,
    text: buildDirectFormTelegramAlert(form)
  });

  let whatsapp = null;

  try {
    whatsapp = await sendWhatsAppResultAlertToAdmins({
      title: form.alertTitle || form.label,
      link: form.url
    });
  } catch (err) {
    whatsapp = {
      success: false,
      error: err.message
    };
  }

  const telegramMessageId = telegram?.message_id || null;

  await alertRef.set(
    {
      type: "result_direct_form_alert",
      formType: form.type,
      label: form.label,
      url: form.url,
      targetYear,
      valid: true,
      status: form.status || null,
      reason: form.reason || "",
      telegramSent: true,
      telegramMessageId,
      whatsapp,
      sent: true,
      suppressed: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    {
      merge: true
    }
  );

  await logEvent("portal_discovery", "warn", "Direct result form alert sent", {
    formType: form.type,
    label: form.label,
    url: form.url,
    telegramMessageId,
    whatsapp
  });

  return {
    type: form.type,
    label: form.label,
    url: form.url,
    sent: true,
    alreadySent: false,
    suppressed: false,
    telegramMessageId,
    whatsapp
  };
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
    let directFormAlertResults = [];

    if (top) {
      urls = derivePortalUrls(top.href);
      directLinks = deriveStableResultLinksFromDetectedUrl(top.href);

      validatedLink = await validateResultLink(top.href);
      directFormValidations = await validateDirectResultForms();

      displayUrl = getBestDisplayUrl({
        directFormValidations,
        validatedLink
      });

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
      update.safePublicResultUrl =
        old.safePublicResultUrl || OFFICIAL_MAIN_PORTAL;
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
      const portalAlertId = makePortalAlertId(targetYear, urls);
      const portalAlertRef = db.collection("result_seen_events").doc(portalAlertId);
      const portalAlertSnap = await portalAlertRef.get();
      const genericPortalAlertAlreadySent =
        portalAlertSnap.exists && portalAlertSnap.data()?.sent;

      if (genericPortalAlertAlreadySent) {
        alertAlreadySent = true;
      }

      const validDirectForms = directFormValidations.filter((item) => item.valid);

      for (const form of validDirectForms) {
        const result = await sendDirectFormAlert({
          targetYear,
          form,
          genericPortalAlertAlreadySent
        });

        directFormAlertResults.push(result);
      }

      if (!validDirectForms.length) {
        if (genericPortalAlertAlreadySent) {
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

          await portalAlertRef.set(
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
      whatsapp,
      directFormAlertResults
    });
  } catch (err) {
    await logEvent("portal_discovery", "error", err.message, {});
    return safeJsonError(res, err);
  }
}
