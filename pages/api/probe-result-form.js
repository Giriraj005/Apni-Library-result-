import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import {
  detectResultStatus,
  submitAspNetResultForm
} from "../../lib/resultParser";
import { createQueueForBatch } from "../../lib/resultQueue";
import { logEvent } from "../../lib/logger";
import { sendTelegramMessage } from "../../lib/telegram";

export default async function handler(req, res) {
  try {
    requireCron(req);

    const sourceSnap = await db.collection("result_sources").doc("pdusu_main").get();
    const source = sourceSnap.exists ? sourceSnap.data() : {};
    const formUrl = source.activeNepResultUrl;

    if (!formUrl) {
      await logEvent("form_probe", "warn", "No active NEP result form URL found", {});
      return res.status(200).json({
        success: true,
        status: "no_form_url"
      });
    }

    const probesSnap = await db
      .collection("result_probe_rolls")
      .where("active", "==", true)
      .limit(10)
      .get();

    if (probesSnap.empty) {
      await logEvent("form_probe", "warn", "No active probe roll numbers configured", {});
      return res.status(200).json({
        success: true,
        status: "no_probe_rolls"
      });
    }

    const results = [];
    let confirmed = false;
    let confirmedProbe = null;

    for (const doc of probesSnap.docs) {
      const probe = doc.data();

      try {
        const out = await submitAspNetResultForm({
          formUrl,
          yearPart: probe.yearPart,
          resultType: probe.resultType || "MAIN",
          rollNo: probe.rollNo
        });

        const status = detectResultStatus(out.html, probe.rollNo);

        results.push({
          id: doc.id,
          rollNo: probe.rollNo,
          yearPart: probe.yearPart,
          status
        });

        await logEvent("form_probe", "info", "Probe checked", {
          rollNo: probe.rollNo,
          yearPart: probe.yearPart,
          status: status.status
        });

        if (status.status === "captcha_detected") {
          await db.collection("result_sources").doc("pdusu_main").set(
            {
              status: "captcha_detected",
              automaticCheckingPaused: true,
              updatedAt: FieldValue.serverTimestamp()
            },
            {
              merge: true
            }
          );

          break;
        }

        if (status.resultFound) {
          confirmed = true;
          confirmedProbe = {
            id: doc.id,
            ...probe,
            status
          };
          break;
        }
      } catch (err) {
        await logEvent("form_probe", "error", err.message, {
          probeId: doc.id
        });

        results.push({
          id: doc.id,
          error: err.message
        });
      }
    }

    if (confirmed) {
      const eventId = "public_live_alert_ug_nep_sem_i_iii_v_main";
      const eventRef = db.collection("result_seen_events").doc(eventId);
      const eventSnap = await eventRef.get();

      await db.collection("result_expected_batches").doc("ug_nep_sem_i_iii_v_main").set(
        {
          title: "UG NEP Semester I III V Main Result 2025-26",
          active: true,
          targetYear: process.env.TARGET_RESULT_YEAR || "2025-26",
          courses: ["B.A.", "B.SC", "B.COM", "B.B.A.", "B.C.A."],
          semesters: ["I", "III", "V"],
          resultType: "MAIN",
          status: "result_confirmed_live",
          resultConfirmed: true,
          confirmedAt: FieldValue.serverTimestamp(),
          confirmedBy: "form_probe",
          confirmedProbe
        },
        {
          merge: true
        }
      );

      const queue = await createQueueForBatch({
        courses: ["B.A.", "B.SC", "B.COM", "B.B.A.", "B.C.A."],
        semesters: ["I", "III", "V"],
        resultType: "MAIN"
      });

      if (!eventSnap.exists) {
        await sendTelegramMessage({
          chatId: process.env.TELEGRAM_PUBLIC_CHAT_ID,
          text: `🎓 <b>PDUSU Result Live Confirmed</b>\n\nUG NEP Semester I, III, V MAIN result official portal par active dikh raha hai.\n\nRegistered students ke roll numbers queue me add ho gaye hain.\n\nQueue Created: ${queue.created}`
        });

        await eventRef.set({
          type: "public_live_alert",
          sent: true,
          createdAt: FieldValue.serverTimestamp()
        });
      }

      await logEvent("form_probe", "warn", "Result confirmed live by form probe", {
        confirmedProbe,
        queue
      });
    }

    return res.status(200).json({
      success: true,
      confirmed,
      confirmedProbe,
      results
    });
  } catch (err) {
    await logEvent("form_probe", "error", err.message, {});
    return safeJsonError(res, err);
  }
}
