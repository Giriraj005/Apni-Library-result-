import { db, FieldValue } from "../../lib/firebaseAdmin";
import { getFormUrlForYearPart } from "../../lib/resultCourseCatalog";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanRoll(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function safeKey(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function makeRegistrationKey({ rollNo, yearPart, resultType, targetYear }) {
  return [
    safeKey(rollNo),
    safeKey(yearPart),
    safeKey(resultType || "MAIN"),
    safeKey(targetYear || "2025-26")
  ]
    .filter(Boolean)
    .join("_");
}

function normalizeMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
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

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed"
      });
    }

    const body = req.body || {};

    const studentName = cleanText(body.studentName || body.name);
    const rollNo = cleanRoll(body.rollNo || body.rollNumber);
    const yearPart = cleanText(body.yearPart || body.course || body.selectedCourse);
    const resultType = cleanText(body.resultType || "MAIN").toUpperCase();
    const targetYear = cleanText(
      body.targetYear || process.env.TARGET_RESULT_YEAR || "2025-26"
    );

    const mobile = normalizeMobile(body.mobile || body.whatsapp || body.phone);
    const formUrl = cleanText(
      body.formUrl || getFormUrlForYearPart(yearPart, body.formUrl)
    );
    const formKey = cleanText(body.formKey || "");
    const source = cleanText(body.source || "student_registration");

    const consentAdminPreview = Boolean(
      body.consentAdminPreview ||
        body.adminConsent ||
        body.consent ||
        body.agree
    );

    if (!studentName) {
      return res.status(400).json({
        success: false,
        error: "Student name required hai."
      });
    }

    if (!rollNo || rollNo.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Valid roll number required hai."
      });
    }

    if (!yearPart) {
      return res.status(400).json({
        success: false,
        error: "Course / year part select karo."
      });
    }

    if (!formUrl) {
      return res.status(400).json({
        success: false,
        error: "Official result form missing hai. Course dobara select karo."
      });
    }

    if (!consentAdminPreview) {
      return res.status(400).json({
        success: false,
        error: "Verification consent required hai."
      });
    }

    const registrationId = makeRegistrationKey({
      rollNo,
      yearPart,
      resultType,
      targetYear
    });

    const registrationRef = db
      .collection("result_registrations")
      .doc(registrationId);

    const existingSnap = await registrationRef.get();

    if (existingSnap.exists) {
      const existing = existingSnap.data() || {};

      return res.status(409).json({
        success: false,
        duplicate: true,
        error:
          "Ye roll number is course aur result type ke liye already registered hai.",
        registrationId,
        status: existing.status || "registered",
        rollNo,
        yearPart,
        resultType,
        targetYear
      });
    }

    const mobileVerifiedForWhatsApp = isVerifiedWhatsAppNumber(mobile);
    const now = FieldValue.serverTimestamp();

    await registrationRef.set({
      registrationId,
      studentName,
      rollNo,
      rollNumber: rollNo,
      yearPart,
      course: yearPart,
      resultType,
      targetYear,
      mobile,
      formUrl,
      formKey,
      source,

      consentAdminPreview: true,

      mobileVerifiedForWhatsApp,
      whatsappDeliveryAllowed: mobileVerifiedForWhatsApp,
      whatsappDeliveryRule: "verified_numbers_only",

      status: "registered",
      resultFound: false,
      adminTelegramSent: false,
      studentWhatsAppSent: false,
      studentWhatsAppSkipped: false,
      studentWhatsAppSkipReason: "",

      createdAt: now,
      updatedAt: now
    });

    return res.status(200).json({
      success: true,
      registrationId,
      rollNo,
      yearPart,
      resultType,
      targetYear,
      mobile,
      mobileVerifiedForWhatsApp,
      whatsappDeliveryAllowed: mobileVerifiedForWhatsApp,
      message: mobileVerifiedForWhatsApp
        ? "Registration successful. Aapka number verified alert list me hai, result/update WhatsApp par bhi aa sakta hai."
        : "Registration successful. Aapka number verified WhatsApp alert list me nahi hai, result status page par update dikhega."
    });
  } catch (err) {
    console.error("register-result-alert error:", err);

    return res.status(500).json({
      success: false,
      error: err.message || "Registration failed"
    });
  }
}
