import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import { makeResultEventKey } from "../../lib/resultQueue";
import { sendTelegramMessage } from "../../lib/telegram";
import { sendWhatsAppStudentResultAuto } from "../../lib/whatsapp";
import { logEvent } from "../../lib/logger";
import { getFormUrlForYearPart } from "../../lib/resultCourseCatalog";

const BATCH_SIZE = 3;
const MAX_ATTEMPTS = 3;

function escapeTelegram(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}

function getVerifiedWhatsAppNumbers() {
  const raw = process.env.WHATSAPP_VERIFIED_NUMBERS || "";

  return new Set(
    raw
      .split(",")
      .map((item) => normalizeMobile(item))
      .filter(Boolean)
  );
}

function isVerifiedWhatsAppNumber(mobile) {
  const normalized = normalizeMobile(mobile);

  if (!normalized) return false;

  const verifiedNumbers = getVerifiedWhatsAppNumbers();

  return verifiedNumbers.has(normalized);
}

function getWorkerUrl() {
  const url = process.env.WORKER_URL;

  if (!url) {
    throw new Error("WORKER_URL is missing");
  }

  return url.replace(/\/+$/, "");
}

function getWorkerSecret() {
  if (!process.env.WORKER_SECRET) {
    throw new Error("WORKER_SECRET is missing");
  }

  return process.env.WORKER_SECRET;
}

function isCleanNotFoundStatus({ status = "", reason = "", error = "" }) {
  const workerStatus = String(status || "").toLowerCase();
  const message = `${reason || ""} ${error || ""}`.toLowerCase();

  const cleanStatuses = ["not_found", "form_returned"];

  if (cleanStatuses.includes(workerStatus)) {
    return true;
  }

  const cleanPhrases = [
    "form returned",
    "record not found",
    "not found",
    "no record",
    "invalid roll",
    "wrong roll",
    "result not declared",
    "result not found"
  ];

  return cleanPhrases.some((phrase) => message.includes(phrase));
}

function getFinalStatusForWorkerResult({ workerResult, attempts }) {
  const status = workerResult?.resultStatus || "";
  const reason = workerResult?.reason || "";
  const error = workerResult?.error || "";

  if (isCleanNotFoundStatus({ status, reason, error })) {
    return "not_found";
  }

  return attempts >= MAX_ATTEMPTS ? "not_found" : "failed_retrying";
}

function getFinalStatusForCaughtError({ err, attempts }) {
  const message = String(err?.message || "");

  if (
    isCleanNotFoundStatus({
      status: "",
      reason: message,
      error: message
    })
  ) {
    return "not_found";
  }

  return attempts >= MAX_ATTEMPTS ? "not_found" : "failed_retrying";
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

  let sm;

  while ((sm = subjectRegex.exec(firstBlock))) {
    subjectLines.push(sm[1].trim().replace(/\s+/g, " "));
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

async function fetchResultFromWorker({ rollNo, yearPart, resultType, formUrl }) {
  const workerUrl = getWorkerUrl();
  const secret = getWorkerSecret();

  const response = await fetch(`${workerUrl}/fetch-result`, {
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
      formUrl
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    throw new Error(
      data?.error || `Worker failed with status ${response.status}`
    );
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

    const queueSnap = await db
      .collection("result_queue")
      .where("status", "in", ["pending", "failed_retrying"])
      .orderBy("attempts", "asc")
      .limit(BATCH_SIZE)
      .get();

    if (queueSnap.empty) {
      return res.status(200).json({
        success: true,
        processed: 0,
        found: 0,
        failed: 0
      });
    }

    let processed = 0;
    let found = 0;
    let failed = 0;
    const results = [];

    for (const doc of queueSnap.docs) {
      const item = doc.data();
      processed += 1;

      const attempts = (item.attempts || 0) + 1;

      await doc.ref.set(
        {
          status: "checking",
          attempts,
          updatedAt: FieldValue.serverTimestamp()
        },
        {
          merge: true
        }
      );

      try {
        const registration = await getRegistration(item);

        const formUrl = item.formUrl || getFormUrlForYearPart(item.yearPart);

        const workerResult = await fetchResultFromWorker({
          rollNo: item.rollNo,
          yearPart: item.yearPart,
          resultType: item.resultType || "MAIN",
          formUrl
        });

        if (workerResult.resultFound) {
          const resultId = makeResultEventKey({
            rollNo: item.rollNo,
            yearPart: item.yearPart,
            resultType: item.resultType,
            targetYear: process.env.TARGET_RESULT_YEAR
          });

          const outputRef = db.collection("result_outputs").doc(resultId);
          const outputSnap = await outputRef.get();
          const outputOld = outputSnap.exists ? outputSnap.data() : {};

          const adminTelegramAlreadySent = Boolean(
            outputOld.adminTelegramSent
          );

          const studentWhatsAppAlreadySent = Boolean(
            outputOld.studentWhatsAppSent
          );

          let adminTelegramResult = null;
          let studentWhatsApp = null;

          const marksSummary =
            workerResult.marksSummary || workerResult.textPreview || "";

          const registrationMobile = normalizeMobile(registration?.mobile || "");
          const whatsappVerified = isVerifiedWhatsAppNumber(registrationMobile);

          if (!adminTelegramAlreadySent) {
            adminTelegramResult = await sendTelegramMessage({
              chatId:
                process.env.TELEGRAM_RESULT_ADMIN_CHAT_ID ||
                process.env.TELEGRAM_ADMIN_CHAT_ID ||
                process.env.TELEGRAM_PUBLIC_CHAT_ID,
              text: buildAdminMarksMessage({
                rollNo: item.rollNo,
                yearPart: item.yearPart,
                resultType: item.resultType || "MAIN",
                officialUrl: formUrl,
                marksSummary,
                studentName: registration?.studentName || "",
                mobile: registration?.mobile || ""
              })
            });
          }

          if (
            registrationMobile &&
            whatsappVerified &&
            !studentWhatsAppAlreadySent
          ) {
            studentWhatsApp = await sendWhatsAppStudentResultAuto({
              to: registrationMobile,
              rollNo: item.rollNo,
              yearPart: item.yearPart,
              resultSummary: makeWhatsAppShortSummary(marksSummary),
              officialUrl: formUrl
            });
          }

          const studentWhatsAppSkipped =
            Boolean(registrationMobile) &&
            !whatsappVerified &&
            !studentWhatsAppAlreadySent;

          const studentWhatsAppSkipReason = studentWhatsAppSkipped
            ? "WhatsApp number verified alert list me nahi hai."
            : "";

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

              adminTelegramSent: true,
              adminTelegramSentAt: FieldValue.serverTimestamp(),
              adminTelegramMessageId:
                adminTelegramResult?.message_id ||
                outputOld.adminTelegramMessageId ||
                null,

              mobileVerifiedForWhatsApp: whatsappVerified,
              whatsappDeliveryRule: "verified_numbers_only",

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
              studentWhatsAppSkipped,
              studentWhatsAppSkipReason,

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
              workerResultStatus: workerResult.resultStatus || "",
              workerReason: workerResult.reason || "",
              updatedAt: FieldValue.serverTimestamp()
            },
            {
              merge: true
            }
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

                  adminTelegramSent: true,
                  adminTelegramSentAt: FieldValue.serverTimestamp(),
                  adminTelegramMessageId:
                    adminTelegramResult?.message_id ||
                    outputOld.adminTelegramMessageId ||
                    null,

                  mobileVerifiedForWhatsApp: whatsappVerified,
                  whatsappDeliveryRule: "verified_numbers_only",

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
                  studentWhatsAppSkipped,
                  studentWhatsAppSkipReason,

                  updatedAt: FieldValue.serverTimestamp()
                },
                {
                  merge: true
                }
              );
          }

          found += 1;

          results.push({
            queueId: doc.id,
            rollNo: item.rollNo,
            yearPart: item.yearPart,
            status: "result_found",
            adminTelegramSent: true,
            mobileVerifiedForWhatsApp: whatsappVerified,
            studentWhatsAppSent:
              studentWhatsApp?.success ||
              outputOld.studentWhatsAppSent ||
              false,
            studentWhatsAppMethod:
              studentWhatsApp?.method ||
              outputOld.studentWhatsApp?.method ||
              "",
            studentWhatsAppSkipped,
            studentWhatsAppSkipReason,
            studentWhatsAppError:
              studentWhatsApp && !studentWhatsApp.success
                ? studentWhatsApp.error
                : ""
          });
        } else {
          const finalStatus = getFinalStatusForWorkerResult({
            workerResult,
            attempts
          });

          const cleanNotFound = finalStatus === "not_found";

          await doc.ref.set(
            {
              status: finalStatus,
              resultFound: false,
              workerResultStatus: workerResult.resultStatus || "",
              workerReason: workerResult.reason || "",
              lastError:
                workerResult.reason ||
                workerResult.error ||
                "Result not found",
              lastTextPreview: workerResult.textPreview || "",
              updatedAt: FieldValue.serverTimestamp()
            },
            {
              merge: true
            }
          );

          if (item.registrationId) {
            await db
              .collection("result_registrations")
              .doc(item.registrationId)
              .set(
                {
                  status: finalStatus,
                  resultFound: false,
                  workerResultStatus: workerResult.resultStatus || "",
                  workerReason: workerResult.reason || "",
                  lastError:
                    workerResult.reason ||
                    workerResult.error ||
                    "Result not found",
                  updatedAt: FieldValue.serverTimestamp()
                },
                {
                  merge: true
                }
              );
          }

          failed += 1;

          results.push({
            queueId: doc.id,
            rollNo: item.rollNo,
            yearPart: item.yearPart,
            status: finalStatus,
            cleanNotFound,
            workerResultStatus: workerResult.resultStatus || "",
            reason: workerResult.reason || workerResult.error || ""
          });
        }
      } catch (err) {
        failed += 1;

        const finalStatus = getFinalStatusForCaughtError({
          err,
          attempts
        });

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

        if (item.registrationId) {
          await db
            .collection("result_registrations")
            .doc(item.registrationId)
            .set(
              {
                status: finalStatus,
                lastError: err.message,
                updatedAt: FieldValue.serverTimestamp()
              },
              {
                merge: true
              }
            );
        }

        await logEvent("queue", "error", err.message, {
          queueId: doc.id,
          finalStatus
        });

        results.push({
          queueId: doc.id,
          rollNo: item.rollNo,
          yearPart: item.yearPart,
          status: finalStatus,
          error: err.message
        });
      }
    }

    await logEvent("queue", "info", "Queue processing completed with worker", {
      processed,
      found,
      failed,
      results
    });

    return res.status(200).json({
      success: true,
      processed,
      found,
      failed,
      results
    });
  } catch (err) {
    await logEvent("queue", "error", err.message, {});
    return safeJsonError(res, err);
  }
            }
