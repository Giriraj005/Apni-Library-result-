import { db, FieldValue } from "../../lib/firebaseAdmin";
import {
  cleanText,
  getYearPart,
  normalizeRollNo,
  safeJsonError
} from "../../lib/security";
import { makeRegistrationKey } from "../../lib/resultQueue";
import { logEvent } from "../../lib/logger";
import {
  resultTypeLabel,
  getFormUrlForYearPart
} from "../../lib/resultCourseCatalog";

function normalizeMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length === 10) return `91${digits}`;

  return digits;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed"
      });
    }

    const body = req.body || {};

    const studentName = cleanText(body.studentName);
    const course = cleanText(body.course).toUpperCase();
    const semester = cleanText(body.semester).toUpperCase();
    const inputYearPart = cleanText(body.yearPart || body.courseOption || "");
    const inputFormUrl = cleanText(body.formUrl || "");
    const formKey = cleanText(body.formKey || "");

    const resultType = resultTypeLabel(
      body.resultType || process.env.DEFAULT_RESULT_TYPE || "MAIN"
    );

    const rollNo = normalizeRollNo(body.rollNo);
    const mobile = normalizeMobile(body.mobile);

    const consentTelegramGroup = Boolean(body.consentTelegramGroup);
    const consentWhatsAppResult = Boolean(body.consentWhatsAppResult);

    if (!studentName) {
      return res.status(400).json({
        success: false,
        error: "Student name is required"
      });
    }

    if (!rollNo) {
      return res.status(400).json({
        success: false,
        error: "Roll number is required"
      });
    }

    if (!inputYearPart && !course) {
      return res.status(400).json({
        success: false,
        error: "Please select course/result option"
      });
    }

    if (!mobile) {
      return res.status(400).json({
        success: false,
        error: "WhatsApp mobile number is required"
      });
    }

    if (!consentTelegramGroup) {
      return res.status(400).json({
        success: false,
        error: "Telegram result alert consent is required"
      });
    }

    if (!consentWhatsAppResult) {
      return res.status(400).json({
        success: false,
        error: "WhatsApp result alert consent is required"
      });
    }

    const yearPart = getYearPart(course || inputYearPart, semester, inputYearPart);
    const formUrl = getFormUrlForYearPart(yearPart, inputFormUrl);

    const id = makeRegistrationKey({
      rollNo,
      course: yearPart,
      semester: semester || "",
      resultType
    });

    const ref = db.collection("result_registrations").doc(id);
    const existing = await ref.get();

    const payload = {
      rollNo,
      course: course || yearPart,
      semester: semester || "",
      yearPart,
      resultType,
      formUrl,
      formKey,

      studentName,
      mobile,

      consentTelegramGroup,
      consentWhatsAppResult,

      status: "waiting",
      resultFound: false,

      adminTelegramSent: false,
      studentWhatsAppSent: false,

      updatedAt: FieldValue.serverTimestamp()
    };

    if (existing.exists) {
      await ref.set(payload, {
        merge: true
      });

      return res.status(200).json({
        success: true,
        updated: true,
        trackingId: id,
        status: "waiting",
        yearPart,
        formUrl,
        formKey,
        message: "Registration already existed, details updated successfully."
      });
    }

    await ref.set({
      ...payload,
      resultId: null,
      createdAt: FieldValue.serverTimestamp()
    });

    await logEvent("registration", "info", "Student registered for result alert", {
      rollNo,
      studentName,
      mobile,
      yearPart,
      resultType,
      formUrl,
      formKey
    });

    return res.status(200).json({
      success: true,
      updated: false,
      trackingId: id,
      status: "waiting",
      yearPart,
      formUrl,
      formKey,
      message: "Result alert registration successful."
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
