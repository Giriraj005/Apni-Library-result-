import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import { hashText } from "../../lib/resultDiscovery";
import { stripHtml } from "../../lib/resultParser";
import { logEvent } from "../../lib/logger";
import { sendTelegramMessage } from "../../lib/telegram";
import { sendWhatsAppResultAlertToAdmins } from "../../lib/whatsapp";

const TARGET_COURSES = ["B.A.", "B.SC", "B.COM", "B.B.A.", "B.C.A."];
const TARGET_SEMESTERS = ["SEMESTER I", "SEMESTER III", "SEMESTER V"];

function buildWhatsAppShareLink(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function buildPlainShareMessage({ url, strongSignals }) {
  return [
    "PDUSU Result Update Detected",
    "",
    strongSignals.length
      ? `Detected Signals:\n${strongSignals.join("\n")}`
      : "Official result listing page par update detect hua hai.",
    "",
    `Official Result Page: ${url}`,
    "",
    "Students official portal par apna roll number check karein.",
    "Source: Official University Result Portal"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildResultMonitorAlert({ url, strongSignals }) {
  const plain = buildPlainShareMessage({ url, strongSignals });
  const shareLink = buildWhatsAppShareLink(plain);

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
    `<b>WhatsApp Share:</b>`,
    shareLink,
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

    let whatsapp = null;

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
            telegramSent: true,
            whatsapp,
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
      whatsapp
    });
  } catch (err) {
    await logEvent("result_monitor", "error", err.message, {});
    return safeJsonError(res, err);
  }
}
