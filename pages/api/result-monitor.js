import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import { hashText } from "../../lib/resultDiscovery";
import { stripHtml, parseHtmlTables } from "../../lib/resultParser";
import { logEvent } from "../../lib/logger";
import { sendTelegramMessage } from "../../lib/telegram";
import { sendWhatsAppResultAlertToAdmins } from "../../lib/whatsapp";
import {
  OFFICIAL_MAIN_PORTAL,
  RESULT26_DIRECT_LINKS,
  validateDirectResultForms
} from "../../lib/resultLinkValidator";

// Courses/semesters Apni Library specifically tracks for its students.
// Rows matching these get a priority marker in the alert, but every
// new row on the schedule table still gets an alert either way.
const PRIORITY_COURSES = ["B.A.", "B.SC", "B.COM", "B.B.A.", "B.C.A."];
// All six semesters, not just I/III/V. Word-boundary matched so
// "SEMESTER I" doesn't also match inside "SEMESTER II".
const PRIORITY_SEMESTER_REGEX = /\bSEMESTER\s*(I|II|III|IV|V|VI)\b/i;

// Matches dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy style dates as seen in the
// official results schedule table (e.g. "27/09/2026").
const DATE_REGEX = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/;

// Words that show a table row is actually a course/semester schedule
// entry, as opposed to some unrelated table on the page.
const COURSE_ROW_PATTERN =
  /B\.?\s?A\.?\b|B\.?\s?SC\b|B\.?\s?COM\b|BBA|BCA|B\.?\s?C\.?\s?A\.?\b|B\.?\s?B\.?\s?A\.?\b|B\.?\s?ED\b|M\.?\s?A\.?\b|M\.?\s?SC\b|M\.?\s?COM\b|PG\s?NEP|SEMESTER|PART\s?\d/i;

function cleanId(value) {
  return String(value || "")
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function isPriorityRow(label) {
  const upper = label.toUpperCase();
  const hasCourse = PRIORITY_COURSES.some((c) => upper.includes(c));
  const hasSemester = PRIORITY_SEMESTER_REGEX.test(upper);
  return hasCourse && hasSemester;
}

// Parses the results-schedule table on the listing page into individual
// (course/semester label, declared date) rows. Each row becomes its own
// independently-tracked "declaration" event, instead of hashing the
// whole page and re-firing on any unrelated change to it.
function extractScheduleRows(html) {
  const tables = parseHtmlTables(html);
  const rows = [];
  const seenIds = new Set();

  for (const table of tables) {
    for (const cells of table) {
      const dateIndex = cells.findIndex((c) => DATE_REGEX.test(c));
      if (dateIndex === -1) continue;

      const dateMatch = cells[dateIndex].match(DATE_REGEX);
      const date = `${dateMatch[1].padStart(2, "0")}/${dateMatch[2].padStart(
        2,
        "0"
      )}/${dateMatch[3]}`;

      const label = cells
        .filter((_, i) => i !== dateIndex)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (!label || !COURSE_ROW_PATTERN.test(label)) continue;

      const id = hashText(`${label.toUpperCase()}|${date}`);
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      rows.push({ label, date, id, priority: isPriorityRow(label) });
    }
  }

  return rows;
}

function buildScheduleRowAlert({ label, date, url, priority }) {
  return [
    priority
      ? "📢 <b>New PDUSU Result Declared (Priority)</b>"
      : "📢 <b>New PDUSU Result Declared</b>",
    "",
    `<b>${label}</b>`,
    `Declared on: ${date}`,
    "",
    "<b>Open Official Result Page:</b>",
    url,
    "",
    "Students official portal par apna roll number check karein.",
    "",
    "Source: Official University Result Portal"
  ].join("\n");
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
  genericPortalAlertAlreadySent,
  force
}) {
  const alertId = makeDirectFormAlertId(targetYear, form);
  const alertRef = db.collection("result_seen_events").doc(alertId);
  const alertSnap = await alertRef.get();

  // force=1 ho toh pehla sent check ignore karo
  if (!force && alertSnap.exists && alertSnap.data()?.sent) {
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

  if (!force && form.type === "PG_NEP" && genericPortalAlertAlreadySent) {
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
    const force = req.query.force === "1";
    // seed=1: record every row currently on the page as already-seen
    // WITHOUT sending alerts. Run this once right after deploying this
    // version, so the backlog of existing rows doesn't all fire at once.
    const seed = req.query.seed === "1";

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
      !force && portalAlertSnap.exists && portalAlertSnap.data()?.sent;

    const directFormValidations = await validateDirectResultForms();
    const validDirectForms = directFormValidations.filter((item) => item.valid);

    const directFormAlertResults = [];

    for (const form of validDirectForms) {
      const result = await sendDirectFormAlert({
        targetYear,
        form,
        genericPortalAlertAlreadySent,
        force
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

    const scheduleRows = extractScheduleRows(html);

    await db.collection("result_sources").doc("pdusu_main").set(
      {
        lastResultListingHash: pageHash,
        lastResultListingCheckedAt: FieldValue.serverTimestamp(),
        lastResultListingUrl: url,
        lastScheduleRows: scheduleRows,
        directFormValidations,
        lastDirectFormAlertResults: directFormAlertResults,
        updatedAt: FieldValue.serverTimestamp()
      },
      {
        merge: true
      }
    );

    // Each row on the schedule table is tracked and alerted on
    // independently, keyed by its own content (label + date) rather
    // than a hash of the whole page. This is what actually fixes the
    // "same message every time" bug: unrelated changes elsewhere on
    // the page no longer make an already-seen row look new.
    const newRowAlerts = [];
    const skippedRows = [];

    for (const row of scheduleRows) {
      const eventId = `schedule_row_${cleanId(row.id)}`;
      const eventRef = db.collection("result_seen_events").doc(eventId);
      const already = await eventRef.get();

      if (already.exists && !force) {
        skippedRows.push({ label: row.label, date: row.date, reason: "already_seen" });
        continue;
      }

      if (seed && !force) {
        await eventRef.set(
          {
            type: "schedule_row",
            label: row.label,
            date: row.date,
            rowId: row.id,
            priority: row.priority,
            url,
            sent: true,
            seeded: true,
            createdAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        skippedRows.push({ label: row.label, date: row.date, reason: "seeded" });
        continue;
      }

      const telegram = await sendTelegramMessage({
        chatId: process.env.TELEGRAM_PUBLIC_CHAT_ID,
        text: buildScheduleRowAlert({
          label: row.label,
          date: row.date,
          url,
          priority: row.priority
        })
      });

      let whatsapp = null;

      try {
        whatsapp = await sendWhatsAppResultAlertToAdmins({
          title: `PDUSU Result: ${row.label}`,
          link: url
        });
      } catch (err) {
        whatsapp = {
          success: false,
          error: err.message
        };
      }

      const telegramMessageId = telegram?.message_id || null;

      await eventRef.set(
        {
          type: "schedule_row",
          label: row.label,
          date: row.date,
          rowId: row.id,
          priority: row.priority,
          url,
          telegramSent: true,
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
        "result_monitor",
        "warn",
        "New result schedule row detected",
        { label: row.label, date: row.date, priority: row.priority, url }
      );

      newRowAlerts.push({
        label: row.label,
        date: row.date,
        priority: row.priority,
        telegramMessageId,
        whatsapp
      });
    }

    return res.status(200).json({
      success: true,
      status: "checked",
      url,
      hash: pageHash,
      seed,
      force,
      scheduleRowsFound: scheduleRows.length,
      newRowAlerts,
      skippedRows,
      directFormValidations,
      directFormAlertResults
    });
  } catch (err) {
    await logEvent("result_monitor", "error", err.message, {});
    return safeJsonError(res, err);
  }
}
