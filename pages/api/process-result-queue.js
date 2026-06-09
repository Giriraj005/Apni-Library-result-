import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import {
  detectResultStatus,
  submitAspNetResultForm
} from "../../lib/resultParser";
import { makeResultEventKey } from "../../lib/resultQueue";
import { sendTelegramMessage } from "../../lib/telegram";
import { logEvent } from "../../lib/logger";
import { getFormUrlForYearPart } from "../../lib/resultCourseCatalog";

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;

function escapeTelegram(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMarksMessage({ rollNo, yearPart, resultType, officialUrl, marksSummary }) {
  return [
    "✅ <b>Result Found</b>",
    "",
    `<b>Roll No:</b> ${escapeTelegram(rollNo)}`,
    `<b>Course:</b> ${escapeTelegram(yearPart)}`,
    `<b>Type:</b> ${escapeTelegram(resultType || "MAIN")}`,
    "",
    "<b>Marks / Result Preview:</b>",
    escapeTelegram(String(marksSummary || "").slice(0, 3200)),
    "",
    "<b>Official Link:</b>",
    officialUrl,
    "",
    "Source: Official University Result Portal"
  ].join("\n");
}

export default async function handler(req, res) {
  try {
    requireCron(req);

    const sourceSnap = await db.collection("result_sources").doc("pdusu_main").get();
    const source = sourceSnap.exists ? sourceSnap.data() : {};

    if (source.automaticCheckingPaused) {
      return res.status(200).json({
        success: true,
        status: "paused"
      });
    }

    const queueSnap = await db
      .collection("result_queue")
      .where("status", "in", ["pending", "failed_retrying"])
      .orderBy("attempts", "asc")
      .limit(BATCH_SIZE)
      .get();

    if (queueSnap.empty) {
      return res.status(200).json({
        success: true,
        processed: 0
      });
    }

    let processed = 0;
    let found = 0;
    let failed = 0;

    for (const doc of queueSnap.docs) {
      const item = doc.data();
      processed += 1;

      await doc.ref.set(
        {
          status: "checking",
          attempts: (item.attempts || 0) + 1,
          updatedAt: FieldValue.serverTimestamp()
        },
        {
          merge: true
        }
      );

      try {
        const formUrl = item.formUrl || getFormUrlForYearPart(item.yearPart);

        const out = await submitAspNetResultForm({
          formUrl,
          yearPart: item.yearPart,
          resultType: item.resultType || "MAIN",
          rollNo: item.rollNo
        });

        const status = detectResultStatus(out.html, item.rollNo);

        if (status.status === "captcha_detected") {
          await db.collection("result_sources").doc("pdusu_main").set(
            {
              automaticCheckingPaused: true,
              status: "captcha_detected",
              updatedAt: FieldValue.serverTimestamp()
            },
            {
              merge: true
            }
          );

          await logEvent("queue", "error", "CAPTCHA detected, automatic checking paused", {
            queueId: doc.id
          });

          break;
        }

        if (status.resultFound) {
          const resultId = makeResultEventKey({
            rollNo: item.rollNo,
            yearPart: item.yearPart,
            resultType: item.resultType,
            targetYear: process.env.TARGET_RESULT_YEAR
          });

          const outputRef = db.collection("result_outputs").doc(resultId);
          const outputSnap = await outputRef.get();
          const alreadySent = outputSnap.exists && outputSnap.data().telegramSent;

          let telegramResult = null;

          if (!alreadySent) {
            telegramResult = await sendTelegramMessage({
              chatId: process.env.TELEGRAM_PUBLIC_CHAT_ID,
              text: buildMarksMessage({
                rollNo: item.rollNo,
                yearPart: item.yearPart,
                resultType: item.resultType || "MAIN",
                officialUrl: formUrl,
                marksSummary: status.marksSummary || status.textPreview
              })
            });
          }

          await outputRef.set(
            {
              rollNo: item.rollNo,
              yearPart: item.yearPart,
              resultType: item.resultType || "MAIN",
              resultText: status.fullText || status.textPreview,
              marksSummary: status.marksSummary || "",
              textPreview: status.textPreview,
              officialUrl: formUrl,
              telegramSent: true,
              telegramSentAt: FieldValue.serverTimestamp(),
              telegramMessageId: telegramResult?.message_id || outputSnap.data()?.telegramMessageId || null,
              fetchedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp()
            },
            {
              merge: true
            }
          );

          await doc.ref.set(
            {
              status: "result_found",
              resultFound: true,
              resultId,
              updatedAt: FieldValue.serverTimestamp()
            },
            {
              merge: true
            }
          );

          if (item.registrationId) {
            await db.collection("result_registrations").doc(item.registrationId).set(
              {
                status: "result_found",
                resultFound: true,
                resultId,
                telegramSent: true,
                telegramSentAt: FieldValue.serverTimestamp(),
                telegramMessageId: telegramResult?.message_id || outputSnap.data()?.telegramMessageId || null,
                updatedAt: FieldValue.serverTimestamp()
              },
              {
                merge: true
              }
            );
          }

          found += 1;
        } else {
          const attempts = (item.attempts || 0) + 1;
          const finalStatus = attempts >= MAX_ATTEMPTS ? "not_found" : "failed_retrying";

          await doc.ref.set(
            {
              status: finalStatus,
              resultFound: false,
              lastError: status.reason,
              lastTextPreview: status.textPreview,
              updatedAt: FieldValue.serverTimestamp()
            },
            {
              merge: true
            }
          );

          if (item.registrationId) {
            await db.collection("result_registrations").doc(item.registrationId).set(
              {
                status: finalStatus,
                updatedAt: FieldValue.serverTimestamp()
              },
              {
                merge: true
              }
            );
          }

          failed += 1;
        }
      } catch (err) {
        failed += 1;

        const attempts = (item.attempts || 0) + 1;
        const finalStatus = attempts >= MAX_ATTEMPTS ? "not_found" : "failed_retrying";

        await doc.ref.set(
          {
            status: finalStatus,
            lastError: err.message,
            updatedAt: FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

        await logEvent("queue", "error", err.message, {
          queueId: doc.id
        });
      }
    }

    await logEvent("queue", "info", "Queue processing completed", {
      processed,
      found,
      failed
    });

    return res.status(200).json({
      success: true,
      processed,
      found,
      failed
    });
  } catch (err) {
    await logEvent("queue", "error", err.message, {});
    return safeJsonError(res, err);
  }
}
