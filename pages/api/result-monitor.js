import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import { hashText } from "../../lib/resultDiscovery";
import { stripHtml } from "../../lib/resultParser";
import { logEvent } from "../../lib/logger";
import { sendTelegramMessage } from "../../lib/telegram";
import { sendWhatsAppResultAlertToAdmins } from "../../lib/whatsapp";
import {
  OFFICIAL_MAIN_PORTAL,
  RESULT26_DIRECT_LINKS,
  validateDirectResultForms
} from "../../lib/resultLinkValidator";

const TARGET_COURSES = ["B.A.", "B.SC", "B.COM", "B.B.A.", "B.C.A."];
const TARGET_SEMESTERS = ["SEMESTER I", "SEMESTER III", "SEMESTER V"];

function cleanId(value) {
  return String(value || "")
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function buildResultMonitorAlert({ url, strongSignals }) {
  return [
    "📢 <b>PDUSU Result Update Detected</b>",
    "",
    "Official result listing page par target semester/course related update detect hua hai.",
    "",
    strongSignals.length
      ? `<b>Detected Signals:</b>\n${strongSignals.join("\n")}`
      : "",
    "",
    "<b>Open Official Result Page:</b>",
    url,
    "",
    "Students official portal par apna roll number check karein.",
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

function makePortalAlertId(targetYear, activeResultBaseUrl) {
  return `result_portal_alert_${cleanId(targetYear)}_${cleanId(
    activeResultBaseUrl || RESULT26_DIRECT_LINKS.resultBaseUrl
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

  await logEvent("result_monitor", "warn", "Direct result form alert sent", {
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

    const targetYear = process.env.TARGET_RESULT_YEAR || "2025-26";

    const sourceSnap = await db.collection("result_sources").doc("pdusu_main").get();

    const source = sourceSnap.exists ? sourceSnap.data() : {};
    const url = source.activeResultsPageUrl || RESULT26_DIRECT_LINKS.resultListUrl;
    const activeResultBaseUrl =
      source.activeResultBaseUrl || RESULT26_DIRECT_LINKS.resultBaseUrl;

    const portalAlertId = makePortalAlertId(targetYear, activeResultBaseUrl);
    const portalAlertSnap = await db
      .collection("result_seen_events")
      .doc(portalAlertId)
      .get();

    const genericPortalAlertAlreadySent =
      portalAlertSnap.exists && portalAlertSnap.data()?.sent;

    const directFormValidations = await validateDirectResultForms();
    const validDirectForms = directFormValidations.filter((item) => item.valid);

    const directFormAlertResults = [];

    for (const form of validDirectForms) {
      const result = await sendDirectFormAlert({
        targetYear,
        form,
        genericPortalAlertAlreadySent
      });

      directFormAlertResults.push(result);
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 ApniLibraryResultAlert/1.0"
      }
    });

    const html = await response.text();
    const text = stripHtml(html);
    const pageHash = hashText(text);

    const upper = text.toUpperCase();
    const strongSignals = [];

    for (const c of TARGET_COURSES) {
      for (const s of TARGET_SEMESTERS) {
        if (upper.includes(c) && upper.includes(s)) {
          strongSignals.push(`${c} ${s}`);
        }
      }
    }

    await db.collection("result_sources").doc("pdusu_main").set(
      {
        lastResultListingHash: pageHash,
        lastResultListingCheckedAt: FieldValue.serverTimestamp(),
        lastResultListingUrl: url,
        lastStrongSignals: strongSignals,
        directFormValidations,
        lastDirectFormAlertResults: directFormAlertResults,
        updatedAt: FieldValue.serverTimestamp()
      },
      {
        merge: true
      }
    );

    const eventId = strongSignals.length
      ? `result_listing_signal_${cleanId(pageHash)}`
      : `result_listing_hash_${cleanId(pageHash)}`;

    const eventRef = db.collection("result_seen_events").doc(eventId);
    const already = await eventRef.get();

    let whatsapp = null;
    let telegramSent = false;

    if (!already.exists) {
      await eventRef.set({
        type: strongSignals.length
          ? "result_listing_signal"
          : "result_listing_hash",
        hash: pageHash,
        url,
        strongSignals,
        directFormValidations,
        directFormAlertResults,
        createdAt: FieldValue.serverTimestamp()
      });

      await logEvent(
        "result_monitor",
        strongSignals.length ? "warn" : "info",
        "Result listing page checked/changed",
        {
          url,
          strongSignals,
          directFormValidations,
          directFormAlertResults
        }
      );

      if (strongSignals.length) {
        await sendTelegramMessage({
          chatId: process.env.TELEGRAM_PUBLIC_CHAT_ID,
          text: buildResultMonitorAlert({
            url,
            strongSignals
          })
        });

        telegramSent = true;

        try {
          whatsapp = await sendWhatsAppResultAlertToAdmins({
            title: "PDUSU Result Update",
            link: url
          });
        } catch (err) {
          whatsapp = {
            success: false,
            error: err.message
          };
        }

        await eventRef.set(
          {
            telegramSent,
            whatsapp,
            sent: true,
            updatedAt: FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );
      }
    }

    return res.status(200).json({
      success: true,
      status: "checked",
      url,
      hash: pageHash,
      changed: !already.exists,
      strongSignals,
      directFormValidations,
      directFormAlertResults,
      telegramSent,
      whatsapp
    });
  } catch (err) {
    await logEvent("result_monitor", "error", err.message, {});
    return safeJsonError(res, err);
  }
}
