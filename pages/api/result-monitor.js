import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import { hashText } from "../../lib/resultDiscovery";
import { stripHtml } from "../../lib/resultParser";
import { logEvent } from "../../lib/logger";
import { sendTelegramMessage } from "../../lib/telegram";

const TARGET_COURSES = ["B.A.", "B.SC", "B.COM", "B.B.A.", "B.C.A."];
const TARGET_SEMESTERS = ["SEMESTER I", "SEMESTER III", "SEMESTER V"];

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
    `<b>Open Official Result Page:</b>`,
    url,
    "",
    "Students official portal par apna roll number check karein.",
    "",
    "Source: Official University Result Portal"
  ]
    .filter(Boolean)
    .join("\n");
}

export default async function handler(req, res) {
  try {
    requireCron(req);

    const sourceSnap = await db.collection("result_sources").doc("pdusu_main").get();

    if (!sourceSnap.exists || !sourceSnap.data().activeResultsPageUrl) {
      await logEvent("result_monitor", "info", "No active result listing URL found yet", {});

      return res.status(200).json({
        success: true,
        status: "no_active_portal"
      });
    }

    const source = sourceSnap.data();
    const url = source.activeResultsPageUrl;

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
        lastStrongSignals: strongSignals
      },
      {
        merge: true
      }
    );

    const eventId = `result_listing_${pageHash}`;
    const eventRef = db.collection("result_seen_events").doc(eventId);
    const already = await eventRef.get();

    if (!already.exists) {
      await eventRef.set({
        type: "result_listing_hash",
        hash: pageHash,
        url,
        strongSignals,
        createdAt: FieldValue.serverTimestamp()
      });

      await logEvent(
        "result_monitor",
        strongSignals.length ? "warn" : "info",
        "Result listing page changed",
        {
          url,
          strongSignals
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
      }
    }

    return res.status(200).json({
      success: true,
      status: "checked",
      url,
      hash: pageHash,
      changed: !already.exists,
      strongSignals
    });
  } catch (err) {
    await logEvent("result_monitor", "error", err.message, {});
    return safeJsonError(res, err);
  }
}
