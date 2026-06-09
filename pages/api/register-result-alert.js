import { db, FieldValue } from "../../lib/firebaseAdmin";
import {
  cleanText,
  getYearPart,
  normalizeRollNo,
  safeJsonError
} from "../../lib/security";
import { makeRegistrationKey } from "../../lib/resultQueue";
import { logEvent } from "../../lib/logger";
import { resultTypeLabel } from "../../lib/resultCourseCatalog";

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
    const inputYearPart = cleanText(body.yearPart || body.courseOption || "");
    const resultType = resultTypeLabel(
      body.resultType || process.env.DEFAULT_RESULT_TYPE || "MAIN"
    );
    const rollNo = normalizeRollNo(body.rollNo);
    const studentName = cleanText(body.studentName);
    const mobile = cleanText(body.mobile);
    const consentTelegramGroup = Boolean(body.consentTelegramGroup);

    if ((!course && !inputYearPart) || !rollNo) {
      return res.status(400).json({
        success: false,
        error: "Course/yearPart and roll number are required"
      });
    }

    if (!consentTelegramGroup) {
      return res.status(400).json({
        success: false,
        error: "Telegram group consent is required"
      });
    }

    const yearPart = getYearPart(course || inputYearPart, semester, inputYearPart);

    const id = makeRegistrationKey({
      rollNo,
      course: course || yearPart,
      semester: semester || "",
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
      course: course || yearPart,
      semester: semester || "",
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
      yearPart,
      resultType
    });

    return res.status(200).json({
      success: true,
      trackingId: id,
      status: "waiting",
      yearPart
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
