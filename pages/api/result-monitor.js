import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import { hashText } from "../../lib/resultDiscovery";
import { stripHtml } from "../../lib/resultParser";
import { logEvent } from "../../lib/logger";
import { sendTelegramMessage } from "../../lib/telegram";

const TARGET_COURSES = ["B.A.", "B.SC", "B.COM", "B.B.A.", "B.C.A."];
const TARGET_SEMESTERS = ["SEMESTER I", "SEMESTER III", "SEMESTER V"];

export default async function handler(req, res) {
  try {
    requireCron(req);

    const sourceSnap = await db.collection("result_sources").doc("pdusu_main").get();

    if (!sourceSnap.exists || !sourceSnap.data().activeResultsPageUrl) {
      await logEvent("result_monitor", "warn", "No active result listing URL found", {});

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

    const pageRef = db.collection("result_seen_events").doc(`listing_${pageHash}`);
    const already = await pageRef.get();

    const strongSignals = [];
    const upper = text.toUpperCase();

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

    if (!already.exists) {
      await pageRef.set({
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
          chatId: process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_PUBLIC_CHAT_ID,
          text: `⚠️ <b>Result listing signal detected</b>\n\nSignals:\n${strongSignals.join(
            "\n"
          )}\n\nPublic alert will be sent only after form probe confirms actual result.`
        });

        await db.collection("result_expected_batches").doc("ug_nep_sem_i_iii_v_main").set(
          {
            title: "UG NEP Semester I III V Main Result 2025-26",
            active: true,
            targetYear: process.env.TARGET_RESULT_YEAR || "2025-26",
            courses: TARGET_COURSES,
            semesters: ["I", "III", "V"],
            resultType: "MAIN",
            status: "result_detected",
            resultConfirmed: false,
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
