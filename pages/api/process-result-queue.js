
import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import { makeResultEventKey } from "../../lib/resultQueue";
import {
  sendWhatsAppStudentResultAuto,
  sendWhatsAppAdminText,
  sendWhatsAppCaptchaPing
} from "../../lib/whatsapp";
import { logEvent } from "../../lib/logger";
import { getFormUrlForYearPart } from "../../lib/resultCourseCatalog";

const BATCH_SIZE = 3;
const MAX_ATTEMPTS = 5;

function escapeTelegram(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getWorkerUrl() {
  const value = process.env.WORKER_URL;

  if (!value) {
    throw new Error("WORKER_URL is missing");
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("WORKER_URL is not a valid URL");
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("WORKER_URL must use HTTP or HTTPS");
  }

  // Remove trailing slashes, but preserve any configured path.
  return parsed.toString().replace(/\/+$/, "");
}

function getWorkerSecret() {
  const secret = process.env.WORKER_SECRET;

  if (!secret) {
    throw new Error("WORKER_SECRET is missing");
  }

  return secret;
}

function getWorkerEndpoint() {
  const base = getWorkerUrl();

  // Avoid appending /fetch-result twice.
  if (/\/fetch-result$/i.test(base)) {
    return base;
  }

  return `${base}/fetch-result`;
}

function compactMarksSummary(text = "") {
  const raw = String(text || "").replace(/\s+/g, " ").trim();

  if (!raw) return "";

  const firstBlock = raw.split(" DISCLAIMER ")[0];
  const parts = [];

  const identityMatch = firstBlock.match(
    /PROVISIONAL MARKSHEET[\s\S]*?College Name\s*:\s*[\s\S]*?(?=PAPER TYPE|COURSE CODE)/i
  );

  if (identityMatch?.[0]) {
    parts.push(identityMatch[0].trim());
  }

  const semesterResultMatch = firstBlock.match(
    /SEMESTER RESULT[\s\S]*?(?=DETAILS OF BACKLOG|FINAL REMARK|RESULT REMARKS|GRADING)/i
  );

  if (semesterResultMatch?.[0]) {
    parts.push(semesterResultMatch[0].trim());
  }

  const subjectLines = [];
  const subjectRegex =
    /((DSE|MAJOR|MINOR|VAC|SEC|AEC)\s+[A-Z0-9]+\s+[\s\S]*?\s+\d+\s+\d+\s+[-\d]+\s+[-\d]+\s+-?\s+\d+\s+\d+\s+\d+\s+[A-Z+]+\s+\d+\s+\d+)/gi;

  let match;

  while ((match = subjectRegex.exec(firstBlock))) {
    subjectLines.push(match[1].trim().replace(/\s+/g, " "));
    if (subjectLines.length >= 10) break;
  }

  if (subjectLines.length) {
    parts.push(`Papers:\n${subjectLines.join("\n")}`);
  }

  let summary = parts.filter(Boolean).join("\n\n").trim();

  if (!summary) {
    summary = firstBlock.slice(0, 3500);
  }

  return summary.slice(0, 3600);
}

function makeWhatsAppShortSummary(text = "") {
  const raw = String(text || "").replace(/\s+/g, " ").trim();

  const totalMatch = raw.match(
    /FIRST SEMESTER\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([-\d.]+|---)\s+([A-Z]+)/i
  );

  if (totalMatch) {
    return `Total Marks: ${totalMatch[2]}/${totalMatch[1]}, SGPA: ${totalMatch[7]}, Result: ${totalMatch[9]}`;
  }

  const totalMarks = raw.match(/TOTAL MARKS\s+(\d+)/i)?.[1];
  const sgpa = raw.match(/\bSGPA\s+([\d.]+)/i)?.[1];
  const result = raw.match(/\b(PAPR|FAPR|BKPR|PASS|FAIL|PROMOTED)\b/i)?.[1];

  const parts = [];

  if (totalMarks) parts.push(`Total Marks: ${totalMarks}`);
  if (sgpa) parts.push(`SGPA: ${sgpa}`);
  if (result) parts.push(`Result: ${result.toUpperCase()}`);

  return parts.length
    ? parts.join(", ")
    : "Result found. Please check the official result link for full marksheet.";
}

function buildAdminMarksMessage({
  rollNo,
  yearPart,
  resultType,
  officialUrl,
  marksSummary,
  studentName,
  mobile
}) {
  const cleanSummary = compactMarksSummary(marksSummary);

  return [
    "✅ <b>Registered Student Result Found</b>",
    "",
    studentName ? `<b>Name:</b> ${escapeTelegram(studentName)}` : "",
    mobile ? `<b>Mobile:</b> ${escapeTelegram(mobile)}` : "",
    `<b>Roll No:</b> ${escapeTelegram(rollNo)}`,
    `<b>Course:</b> ${escapeTelegram(yearPart)}`,
    `<b>Type:</b> ${escapeTelegram(resultType || "MAIN")}`,
    "",
    "<b>Marks / Result Preview:</b>",
    escapeTelegram(
      cleanSummary ||
        "Result found. Please open official link for full marksheet."
    ),
    "",
    "<b>Official Link:</b>",
    officialUrl,
    "",
    "Note: This is an auto-fetched preview from the official university result portal.",
    "",
    "Source: Official University Result Portal"
  ]
    .filter(Boolean)
    .join("\n");
}

// Admin copy of a found result, as plain WhatsApp text (no HTML).
function buildAdminWhatsAppMessage({
  rollNo,
  yearPart,
  resultType,
  officialUrl,
  marksSummary,
  studentName,
  mobile
}) {
  const cleanSummary = compactMarksSummary(marksSummary);

  return [
    "✅ *Registered Student Result Found*",
    "",
    studentName ? `*Name:* ${studentName}` : "",
    mobile ? `*Mobile:* ${mobile}` : "",
    `*Roll No:* ${rollNo}`,
    `*Course:* ${yearPart}`,
    `*Type:* ${resultType || "MAIN"}`,
    "",
    "*Marks / Result Preview:*",
    cleanSummary ||
      "Result found. Please open official link for full marksheet.",
    "",
    "*Official Link:*",
    officialUrl,
    "",
    "Note: auto-fetched preview from the official university result portal."
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");
}

const CAPTCHA_PING_MIN_GAP_MS =
  (Number(process.env.CAPTCHA_PING_MIN_MINUTES) || 5) * 60 * 1000;

// Pings the admin on WhatsApp when roll numbers are parked for a CAPTCHA.
// At most one ping per CAPTCHA_PING_MIN_MINUTES. The time of the last ping is
// kept on the result_sources/pdusu_main doc that this route already reads, so
// a run with nothing to ping costs no extra Firestore reads.
async function maybePingCaptcha(req, source) {
  try {
    const last = source.lastCaptchaPingAt?.toMillis
      ? source.lastCaptchaPingAt.toMillis()
      : 0;

    if (Date.now() - last < CAPTCHA_PING_MIN_GAP_MS) {
      return { skipped: "pinged recently" };
    }

    const countSnap = await db
      .collection("result_queue")
      .where("status", "==", "needs_captcha")
      .count()
      .get();

    const waiting = countSnap.data().count;

    if (!waiting) return { skipped: "none waiting" };

    const host = req.headers["x-forwarded-host"] || req.headers.host;

    const base = String(
      process.env.PUBLIC_APP_URL || `https://${host}`
    ).replace(/\/+$/, "");

    const out = await sendWhatsAppCaptchaPing({
      count: waiting,
      link: `${base}/admin/captcha`
    });

    if (out.sent > 0) {
      await db
        .collection("result_sources")
        .doc("pdusu_main")
        .set(
          {
            lastCaptchaPingAt: FieldValue.serverTimestamp(),
            lastCaptchaPingCount: waiting
          },
          { merge: true }
        );
    } else {
      await logEvent("queue", "warn", "CAPTCHA WhatsApp ping not delivered", {
        results: out.results
      });
    }

    return { waiting, sent: out.sent, failed: out.failed };
  } catch (err) {
    await logEvent(
      "queue",
      "warn",
      "CAPTCHA WhatsApp ping failed: " + (err.message || err),
      {}
    );

    return { error: String(err.message || err) };
  }
}

async function fetchResultFromWorker({
  rollNo,
  yearPart,
  resultType,
  formUrl,
  dob
}) {
  const endpoint = getWorkerEndpoint();
  const secret = getWorkerSecret();

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": secret
      },
      body: JSON.stringify({
        secret,
        rollNo,
        yearPart,
        resultType,
        formUrl,
        dob
      })
    });
  } catch (err) {
    throw new Error(
      `Worker network error: ${err.message || "Request failed"}`
    );
  }

  const responseText = await response.text();

  let data = null;

  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    let safeEndpoint = "Worker endpoint";

    try {
      const parsed = new URL(endpoint);
      safeEndpoint = `${parsed.origin}${parsed.pathname}`;
    } catch {}

    const details = String(
      data?.error ||
      data?.message ||
      responseText ||
      "No response body"
    )
      .replace(/\s+/g, " ")
      .slice(0, 500);

    throw new Error(
      `Worker HTTP ${response.status} at ${safeEndpoint}: ${details}`
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error("Worker returned invalid JSON");
  }

  return data;
}

async function getRegistration(item) {
  if (!item.registrationId) return null;

  const snap = await db
    .collection("result_registrations")
    .doc(item.registrationId)
    .get();

  return snap.exists ? snap.data() : null;
}

async function syncMissingQueueEntries() {
  try {
    const regSnap = await db
      .collection("result_registrations")
      .where("status", "in", ["waiting", "pending"])
      .limit(20)
      .get();

    if (regSnap.empty) return 0;

    let synced = 0;

    for (const doc of regSnap.docs) {
      const data = doc.data();
      const queueRef = db.collection("result_queue").doc(doc.id);
      const queueSnap = await queueRef.get();

      if (!queueSnap.exists) {
        await queueRef.set({
          rollNo: data.rollNo,
          yearPart: data.yearPart,
          resultType: data.resultType || "MAIN",
          formUrl: data.formUrl || getFormUrlForYearPart(data.yearPart),
          formKey: data.formKey || "",
          dateOfBirth: data.dateOfBirth || "",
          registrationId: doc.id,
          status: "pending",
          attempts: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        synced++;
      }
    }

    return synced;
  } catch (err) {
    await logEvent(
      "queue",
      "warn",
      "syncMissingQueueEntries failed: " + err.message,
      {}
    );

    return 0;
  }
}

export default async function handler(req, res) {
  try {
    requireCron(req);

    const sourceSnap = await db
      .collection("result_sources")
      .doc("pdusu_main")
      .get();

    const source = sourceSnap.exists ? sourceSnap.data() : {};

    if (source.automaticCheckingPaused) {
      return res.status(200).json({
        success: true,
        status: "paused"
      });
    }

    const synced = await syncMissingQueueEntries();

    // Items whose CAPTCHA was solved by a person on the admin page carry a
    // ready result. Handle those first so alerts go out right away.
    const manualSnap = await db
      .collection("result_queue")
      .where("hasManualResult", "==", true)
      .limit(BATCH_SIZE)
      .get();

    const manualDocs = manualSnap.docs.filter((d) =>
      ["pending", "failed_retrying"].includes(d.data().status)
    );

    const manualIds = new Set(manualDocs.map((d) => d.id));

    const queueSnap = await db
      .collection("result_queue")
      .where("status", "in", ["pending", "failed_retrying"])
      .orderBy("attempts", "asc")
      .limit(BATCH_SIZE)
      .get();

    const queueDocs = [
      ...manualDocs,
      ...queueSnap.docs.filter((d) => !manualIds.has(d.id))
    ].slice(0, BATCH_SIZE);

    if (!queueDocs.length) {
      return res.status(200).json({
        success: true,
        processed: 0,
        found: 0,
        failed: 0,
        synced
      });
    }

    let processed = 0;
    let found = 0;
    let failed = 0;
    let needsCaptcha = 0;
    const results = [];

    for (const doc of queueDocs) {
      const item = doc.data();
      processed++;

      const attempts = (item.attempts || 0) + 1;

      await doc.ref.set(
        {
          status: "checking",
          attempts,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      try {
        const registration = await getRegistration(item);

        const formUrl =
          item.formUrl || getFormUrlForYearPart(item.yearPart);

        const dob =
          registration?.dateOfBirth || item.dateOfBirth || "";

        // A result a person already fetched through the CAPTCHA page wins;
        // otherwise ask the worker as usual.
        const workerResult =
          item.manualWorkerResult && item.manualWorkerResult.resultFound
            ? item.manualWorkerResult
            : await fetchResultFromWorker({
                rollNo: item.rollNo,
                yearPart: item.yearPart,
                resultType: item.resultType || "MAIN",
                formUrl,
                dob
              });

        // The university form is asking for a CAPTCHA. Retrying can't fix
        // that, and it says nothing about whether the result exists, so park
        // the item instead of retrying or counting it towards MAX_ATTEMPTS.
        if (workerResult.needsHuman) {
          await doc.ref.set(
            {
              status: "needs_captcha",
              resultFound: false,
              attempts: item.attempts || 0,
              workerResultStatus: workerResult.resultStatus || "",
              lastError: workerResult.reason || "captcha_required",
              updatedAt: FieldValue.serverTimestamp()
            },
            { merge: true }
          );

          needsCaptcha++;

          results.push({
            queueId: doc.id,
            rollNo: item.rollNo,
            yearPart: item.yearPart,
            status: "needs_captcha",
            reason: workerResult.reason || "captcha_required"
          });

          continue;
        }

        if (workerResult.resultFound) {
          const resultId = makeResultEventKey({
            rollNo: item.rollNo,
            yearPart: item.yearPart,
            resultType: item.resultType || "MAIN",
            targetYear: process.env.TARGET_RESULT_YEAR
          });

          const outputRef = db.collection("result_outputs").doc(resultId);
          const outputSnap = await outputRef.get();
          const outputOld = outputSnap.exists ? outputSnap.data() : {};

          const adminTelegramAlreadySent =
            Boolean(outputOld.adminTelegramSent);

          const studentWhatsAppAlreadySent = Boolean(
            outputOld.studentWhatsAppSent &&
            outputOld.studentWhatsApp?.success
          );

          let adminTelegramResult = null;
          let studentWhatsApp = null;

          // Admin copy goes to WhatsApp now (was Telegram). The stored field
          // names (adminTelegramSent ...) are kept so old records still work;
          // they now mean "admin copy sent". A failure here never blocks the
          // student's message below.
          if (!adminTelegramAlreadySent) {
            try {
              const adminWa = await sendWhatsAppAdminText({
                text: buildAdminWhatsAppMessage({
                  rollNo: item.rollNo,
                  yearPart: item.yearPart,
                  resultType: item.resultType || "MAIN",
                  officialUrl: formUrl,
                  marksSummary:
                    workerResult.marksSummary ||
                    workerResult.textPreview ||
                    "",
                  studentName: registration?.studentName || "",
                  mobile: registration?.mobile || ""
                }),
                templateName:
                  process.env.WHATSAPP_ADMIN_RESULT_TEMPLATE_NAME || "",
                templateParams: [
                  item.rollNo,
                  item.yearPart,
                  compactMarksSummary(
                    workerResult.marksSummary ||
                      workerResult.textPreview ||
                      ""
                  ).slice(0, 600) || "Result found",
                  formUrl
                ]
              });

              if (adminWa.sent > 0) {
                adminTelegramResult = {
                  message_id:
                    adminWa.results.find((r) => r.success)?.result
                      ?.messages?.[0]?.id || "whatsapp"
                };
              } else {
                await logEvent(
                  "queue",
                  "warn",
                  "Admin WhatsApp copy not delivered for " + item.rollNo,
                  { results: adminWa.results }
                );
              }
            } catch (adminErr) {
              await logEvent(
                "queue",
                "warn",
                "Admin WhatsApp copy failed for " + item.rollNo,
                { error: adminErr.message }
              );
            }
          }

          const studentMobile =
            registration?.mobile || item.mobile || "";

          if (studentMobile && !studentWhatsAppAlreadySent) {
            try {
              studentWhatsApp = await sendWhatsAppStudentResultAuto({
                to: studentMobile,
                rollNo: item.rollNo,
                yearPart: item.yearPart,
                resultSummary: makeWhatsAppShortSummary(
                  workerResult.marksSummary ||
                  workerResult.textPreview ||
                  ""
                ),
                officialUrl: formUrl
              });
            } catch (waErr) {
              studentWhatsApp = {
                success: false,
                error: waErr.message || "WhatsApp send failed"
              };

              await logEvent(
                "queue",
                "warn",
                "WhatsApp send failed for " + item.rollNo,
                { error: waErr.message }
              );
            }
          }

          await outputRef.set(
            {
              rollNo: item.rollNo,
              yearPart: item.yearPart,
              resultType: item.resultType || "MAIN",
              resultText: workerResult.textPreview || "",
              marksSummary: workerResult.marksSummary || "",
              officialUrl: formUrl,
              workerResultStatus: workerResult.resultStatus || "",
              workerReason: workerResult.reason || "",
              selected: workerResult.selected || {},

              adminTelegramSent:
                adminTelegramAlreadySent ||
                Boolean(adminTelegramResult),
              adminTelegramSentAt:
                adminTelegramAlreadySent
                  ? outputOld.adminTelegramSentAt || null
                  : FieldValue.serverTimestamp(),
              adminTelegramMessageId:
                adminTelegramResult?.message_id ||
                outputOld.adminTelegramMessageId ||
                null,

              studentWhatsAppSent:
                studentWhatsApp?.success ||
                outputOld.studentWhatsAppSent ||
                false,
              studentWhatsApp:
                studentWhatsApp || outputOld.studentWhatsApp || null,
              studentWhatsAppSentAt: studentWhatsApp?.success
                ? FieldValue.serverTimestamp()
                : outputOld.studentWhatsAppSentAt || null,
              studentWhatsAppLastError:
                studentWhatsApp && !studentWhatsApp.success
                  ? studentWhatsApp.error
                  : outputOld.studentWhatsAppLastError || "",

              fetchedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp()
            },
            { merge: true }
          );

          await doc.ref.set(
            {
              status: "result_found",
              resultFound: true,
              resultId,
              workerResultStatus: workerResult.resultStatus || "",
              hasManualResult: false,
              manualWorkerResult: FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp()
            },
            { merge: true }
          );

          if (item.registrationId) {
            await db
              .collection("result_registrations")
              .doc(item.registrationId)
              .set(
                {
                  status: "result_found",
                  resultFound: true,
                  resultId,
                  adminTelegramSent:
                    adminTelegramAlreadySent ||
                    Boolean(adminTelegramResult),
                  adminTelegramSentAt:
                    adminTelegramAlreadySent
                      ? outputOld.adminTelegramSentAt || null
                      : FieldValue.serverTimestamp(),
                  adminTelegramMessageId:
                    adminTelegramResult?.message_id ||
                    outputOld.adminTelegramMessageId ||
                    null,
                  studentWhatsAppSent:
                    studentWhatsApp?.success ||
                    outputOld.studentWhatsAppSent ||
                    false,
                  studentWhatsApp:
                    studentWhatsApp || outputOld.studentWhatsApp || null,
                  studentWhatsAppLastError:
                    studentWhatsApp && !studentWhatsApp.success
                      ? studentWhatsApp.error
                      : outputOld.studentWhatsAppLastError || "",
                  updatedAt: FieldValue.serverTimestamp()
                },
                { merge: true }
              );
          }

          found++;

          results.push({
            queueId: doc.id,
            rollNo: item.rollNo,
            yearPart: item.yearPart,
            status: "result_found",
            adminTelegramSent:
              adminTelegramAlreadySent ||
              Boolean(adminTelegramResult),
            studentWhatsAppSent: Boolean(
              studentWhatsApp?.success ||
              outputOld.studentWhatsAppSent
            ),
            studentWhatsAppMethod: studentWhatsApp?.method || "",
            studentWhatsAppError:
              studentWhatsApp && !studentWhatsApp.success
                ? studentWhatsApp.error
                : ""
          });
        } else {
          const finalStatus =
            attempts >= MAX_ATTEMPTS
              ? "not_found"
              : "failed_retrying";

          await doc.ref.set(
            {
              status: finalStatus,
              resultFound: false,
              workerResultStatus: workerResult.resultStatus || "",
              lastError:
                workerResult.reason ||
                workerResult.error ||
                "Result not found",
              lastTextPreview: workerResult.textPreview || "",
              updatedAt: FieldValue.serverTimestamp()
            },
            { merge: true }
          );

          if (item.registrationId) {
            await db
              .collection("result_registrations")
              .doc(item.registrationId)
              .set(
                {
                  status: finalStatus,
                  updatedAt: FieldValue.serverTimestamp()
                },
                { merge: true }
              );
          }

          failed++;

          results.push({
            queueId: doc.id,
            rollNo: item.rollNo,
            yearPart: item.yearPart,
            status: finalStatus,
            reason:
              workerResult.reason ||
              workerResult.error ||
              "Result not found"
          });
        }
      } catch (err) {
        failed++;

        // Infrastructure/HTTP errors are not proof that a result
        // does not exist. Keep them retryable.
        await doc.ref.set(
          {
            status: "failed_retrying",
            lastError: String(err.message || err).slice(0, 1000),
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        await logEvent(
          "queue",
          "error",
          String(err.message || err),
          { queueId: doc.id }
        );

        results.push({
          queueId: doc.id,
          rollNo: item.rollNo,
          yearPart: item.yearPart,
          status: "failed_retrying",
          error: String(err.message || err).slice(0, 1000)
        });
      }
    }

    const captchaPing =
      needsCaptcha > 0 ? await maybePingCaptcha(req, source) : null;

    await logEvent(
      "queue",
      "info",
      "Queue processing completed with worker",
      { processed, found, failed, needsCaptcha, synced, results }
    );

    return res.status(200).json({
      success: true,
      processed,
      found,
      failed,
      needsCaptcha,
      captchaPing,
      synced,
      results
    });
  } catch (err) {
    await logEvent("queue", "error", err.message, {});
    return safeJsonError(res, err);
  }
}
