import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import { sendWhatsAppStudentResult } from "../../lib/whatsapp";
import { logEvent } from "../../lib/logger";

const BATCH_SIZE = 10;

function makeWhatsAppShortSummary(text = "") {
  const raw = String(text || "").replace(/\s+/g, " ").trim();

  const totalMatch = raw.match(
    /FIRST SEMESTER\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([-\d.]+|---)\s+([A-Z]+)/i
  );

  if (totalMatch) {
    return `Total Marks: ${totalMatch[2]}/${totalMatch[1]}, SGPA: ${totalMatch[7]}, Result: ${totalMatch[9]}`;
  }

  const sgpa = raw.match(/\bSGPA\s+([\d.]+)/i)?.[1];
  const result = raw.match(/\b(PAPR|FAPR|BKPR|PASS|FAIL|PROMOTED)\b/i)?.[1];

  const parts = [];

  if (sgpa) parts.push(`SGPA: ${sgpa}`);
  if (result) parts.push(`Result: ${result.toUpperCase()}`);

  return parts.length
    ? parts.join(", ")
    : "Result found. Please check the official result link for full marksheet.";
}

export default async function handler(req, res) {
  try {
    requireCron(req);

    const registrationsSnap = await db
      .collection("result_registrations")
      .where("status", "==", "result_found")
      .where("studentWhatsAppSent", "==", false)
      .limit(BATCH_SIZE)
      .get();

    if (registrationsSnap.empty) {
      return res.status(200).json({
        success: true,
        processed: 0,
        sent: 0,
        failed: 0
      });
    }

    let processed = 0;
    let sent = 0;
    let failed = 0;
    const results = [];

    for (const regDoc of registrationsSnap.docs) {
      processed += 1;

      const reg = regDoc.data();

      if (!reg.mobile || !reg.resultId) {
        failed += 1;

        await regDoc.ref.set(
          {
            studentWhatsAppLastError: "Missing mobile or resultId",
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        results.push({
          registrationId: regDoc.id,
          success: false,
          error: "Missing mobile or resultId"
        });

        continue;
      }

      const outputSnap = await db
        .collection("result_outputs")
        .doc(reg.resultId)
        .get();

      if (!outputSnap.exists) {
        failed += 1;

        await regDoc.ref.set(
          {
            studentWhatsAppLastError: "Result output not found",
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        results.push({
          registrationId: regDoc.id,
          success: false,
          error: "Result output not found"
        });

        continue;
      }

      const output = outputSnap.data();

      try {
        const whatsapp = await sendWhatsAppStudentResult({
          to: reg.mobile,
          rollNo: reg.rollNo,
          yearPart: reg.yearPart,
          resultSummary: makeWhatsAppShortSummary(
            output.marksSummary || output.resultText || ""
          ),
          officialUrl: output.officialUrl || reg.formUrl || "https://shekhauniexam.in/"
        });

        await regDoc.ref.set(
          {
            studentWhatsAppSent: true,
            studentWhatsApp,
            studentWhatsAppSentAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        await outputSnap.ref.set(
          {
            studentWhatsAppSent: true,
            studentWhatsApp,
            studentWhatsAppSentAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        sent += 1;

        results.push({
          registrationId: regDoc.id,
          rollNo: reg.rollNo,
          success: true
        });
      } catch (err) {
        failed += 1;

        await regDoc.ref.set(
          {
            studentWhatsAppSent: false,
            studentWhatsAppLastError: err.message,
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        results.push({
          registrationId: regDoc.id,
          rollNo: reg.rollNo,
          success: false,
          error: err.message
        });
      }
    }

    await logEvent("student_whatsapp_retry", "info", "Student WhatsApp retry completed", {
      processed,
      sent,
      failed
    });

    return res.status(200).json({
      success: true,
      processed,
      sent,
      failed,
      results
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
      }
