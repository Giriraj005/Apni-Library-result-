import { db, FieldValue } from "../../lib/firebaseAdmin";
import {
  cleanText,
  getYearPart,
  normalizeRollNo,
  safeJsonError
} from "../../lib/security";
import { makeRegistrationKey } from "../../lib/resultQueue";
import { logEvent } from "../../lib/logger";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed"
      });
    }

    const body = req.body || {};

    const course = cleanText(body.course).toUpperCase();
    const semester = cleanText(body.semester).toUpperCase();
    const resultType = cleanText(
      body.resultType || process.env.DEFAULT_RESULT_TYPE || "MAIN"
    ).toUpperCase();

    const rollNo = normalizeRollNo(body.rollNo);
    const studentName = cleanText(body.studentName);
    const mobile = cleanText(body.mobile);
    const consentTelegramGroup = Boolean(body.consentTelegramGroup);

    if (!course || !semester || !rollNo) {
      return res.status(400).json({
        success: false,
        error: "Course, semester and roll number are required"
      });
    }

    if (!["I", "III", "V"].includes(semester)) {
      return res.status(400).json({
        success: false,
        error: "Only Semester I, III and V are enabled currently"
      });
    }

    if (!consentTelegramGroup) {
      return res.status(400).json({
        success: false,
        error: "Telegram group consent is required for this MVP"
      });
    }

    const yearPart = getYearPart(course, semester);

    const id = makeRegistrationKey({
      rollNo,
      course,
      semester,
      resultType
    });

    const ref = db.collection("result_registrations").doc(id);
    const existing = await ref.get();

    if (existing.exists) {
      return res.status(409).json({
        success: false,
        error:
          "This roll number is already registered for selected course, semester and result type"
      });
    }

    await ref.set({
      rollNo,
      course,
      semester,
      yearPart,
      resultType,
      studentName,
      mobile,
      consentTelegramGroup,
      status: "waiting",
      resultFound: false,
      resultId: null,
      telegramSent: false,
      telegramSentAt: null,
      telegramMessageId: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    await logEvent("registration", "info", "Student registered for result alert", {
      rollNo,
      course,
      semester,
      resultType
    });

    return res.status(200).json({
      success: true,
      trackingId: id,
      status: "waiting"
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
