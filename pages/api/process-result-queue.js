import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import { makeResultEventKey } from "../../lib/resultQueue";
import { logEvent } from "../../lib/logger";

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;

async function callWorker({ formUrl, yearPart, resultType, rollNo }) {
  if (!process.env.WORKER_URL) {
    throw new Error("WORKER_URL missing in Vercel env");
  }

  if (!process.env.WORKER_SECRET) {
    throw new Error("WORKER_SECRET missing in Vercel env");
  }

  const response = await fetch(`${process.env.WORKER_URL}/fetch-result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": process.env.WORKER_SECRET
    },
    body: JSON.stringify({
      formUrl,
      yearPart,
      resultType,
      rollNo,
      sendTelegram: true
    })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Worker fetch failed");
  }

  return data;
}

export default async function handler(req, res) {
  try {
    requireCron(req);

    const sourceSnap = await db.collection("result_sources").doc("pdusu_main").get();
    const source = sourceSnap.exists ? sourceSnap.data() : {};
    const formUrl = source.activeNepResultUrl;

    if (!formUrl) {
      return res.status(200).json({
        success: true,
        status: "no_form_url"
      });
    }

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

      const nextAttempt = (item.attempts || 0) + 1;

      await doc.ref.set(
        {
          status: "checking",
          attempts: nextAttempt,
          updatedAt: FieldValue.serverTimestamp()
        },
        {
          merge: true
        }
      );

      try {
        const workerResult = await callWorker({
          formUrl,
          yearPart: item.yearPart,
          resultType: item.resultType || "MAIN",
          rollNo: item.rollNo
        });

        if (workerResult.status === "captcha_detected") {
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

          await logEvent("queue", "error", "CAPTCHA detected by worker", {
            queueId: doc.id
          });

          break;
        }

        if (workerResult.resultFound) {
          const resultId = makeResultEventKey({
            rollNo: item.rollNo,
            yearPart: item.yearPart,
            resultType: item.resultType,
            targetYear: process.env.TARGET_RESULT_YEAR
          });

          await db.collection("result_outputs").doc(resultId).set(
            {
              rollNo: item.rollNo,
              yearPart: item.yearPart,
              resultType: item.resultType || "MAIN",
              resultText: workerResult.textPreview || "",
              textPreview: workerResult.textPreview || "",
              officialUrl: formUrl,
              telegramSent: Boolean(workerResult.telegramSent),
              telegramSentAt: workerResult.telegramSent
                ? FieldValue.serverTimestamp()
                : null,
              telegramMessageId: workerResult.telegramMessageId || null,
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
                telegramSent: Boolean(workerResult.telegramSent),
                telegramSentAt: workerResult.telegramSent
                  ? FieldValue.serverTimestamp()
                  : null,
                telegramMessageId: workerResult.telegramMessageId || null,
                updatedAt: FieldValue.serverTimestamp()
              },
              {
                merge: true
              }
            );
          }

          found += 1;
        } else {
          const finalStatus =
            nextAttempt >= MAX_ATTEMPTS ? "not_found" : "failed_retrying";

          await doc.ref.set(
            {
              status: finalStatus,
              resultFound: false,
              lastError: workerResult.reason || workerResult.status,
              lastTextPreview: workerResult.textPreview || "",
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

        const finalStatus =
          nextAttempt >= MAX_ATTEMPTS ? "not_found" : "failed_retrying";

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

    await logEvent("queue", "info", "Queue processing completed by worker", {
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
