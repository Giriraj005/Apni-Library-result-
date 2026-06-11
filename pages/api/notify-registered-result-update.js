import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import {
  OFFICIAL_MAIN_PORTAL,
  RESULT_FORM_CANDIDATES,
  validateResultLink
} from "../../lib/resultCourseCatalog";

const DEFAULT_TEMPLATE_NAME = "pdusu_result_update_v2";
const DEFAULT_TEMPLATE_LANG = "en_US";
const BATCH_SIZE = 20;

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

function safeKey(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function makeNotificationId({ rollNo, yearPart, resultType, targetYear, formUrl }) {
  return [
    safeKey(rollNo),
    safeKey(yearPart),
    safeKey(resultType || "MAIN"),
    safeKey(targetYear || "2025-26"),
    safeKey(formUrl)
  ]
    .filter(Boolean)
    .join("_");
}

async function sendRegisteredUpdateTemplate({
  to,
  title,
  resultLink,
  mainPortal
}) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID missing");
  }

  if (!accessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN missing");
  }

  const templateName =
    process.env.WHATSAPP_REGISTERED_UPDATE_TEMPLATE_NAME ||
    DEFAULT_TEMPLATE_NAME;

  const language =
    process.env.WHATSAPP_REGISTERED_UPDATE_TEMPLATE_LANG ||
    DEFAULT_TEMPLATE_LANG;

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: language
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: title
                },
                {
                  type: "text",
                  text: resultLink
                },
                {
                  type: "text",
                  text: mainPortal
                }
              ]
            }
          ]
        }
      })
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.error ||
        `WhatsApp API failed with ${response.status}`
    );
  }

  return {
    success: true,
    method: "template",
    templateName,
    language,
    data
  };
}

async function getActiveFormUrls() {
  const activeFormUrls = [];
  const forms = [];

  for (const form of RESULT_FORM_CANDIDATES) {
    try {
      const validation = await validateResultLink(form.url);

      forms.push({
        key: form.key,
        label: form.label,
        url: form.url,
        ...validation
      });

      if (validation.valid) {
        activeFormUrls.push(form.url);
      }
    } catch (err) {
      forms.push({
        key: form.key,
        label: form.label,
        url: form.url,
        valid: false,
        error: err.message || "validation failed"
      });
    }
  }

  return {
    activeFormUrls,
    forms
  };
}

export default async function handler(req, res) {
  try {
    requireCron(req);

    const dryRun = req.query.dry === "1";
    const force = req.query.force === "1";
    const targetYear = process.env.TARGET_RESULT_YEAR || "2025-26";

    const { activeFormUrls, forms } = await getActiveFormUrls();

    if (!activeFormUrls.length) {
      return res.status(200).json({
        success: true,
        dryRun,
        force,
        activeFormUrls,
        forms,
        processed: 0,
        sent: 0,
        skipped: 0,
        results: []
      });
    }

    const registrationsSnap = await db
      .collection("result_registrations")
      .where("targetYear", "==", targetYear)
      .limit(BATCH_SIZE)
      .get();

    let processed = 0;
    let sent = 0;
    let skipped = 0;
    const results = [];

    for (const doc of registrationsSnap.docs) {
      const reg = doc.data() || {};
      processed += 1;

      const formUrl = reg.formUrl || "";
      const mobile = normalizeMobile(reg.mobile || "");

      if (!activeFormUrls.includes(formUrl)) {
        skipped += 1;
        results.push({
          registrationId: doc.id,
          rollNo: reg.rollNo,
          yearPart: reg.yearPart,
          skipped: true,
          reason: "form_not_active"
        });
        continue;
      }

      if (!mobile) {
        skipped += 1;
        results.push({
          registrationId: doc.id,
          rollNo: reg.rollNo,
          yearPart: reg.yearPart,
          skipped: true,
          reason: "mobile_missing"
        });
        continue;
      }

      if (!isVerifiedWhatsAppNumber(mobile)) {
        skipped += 1;

        await doc.ref.set(
          {
            registeredUpdateWhatsAppSkipped: true,
            registeredUpdateWhatsAppSkipReason:
              "WhatsApp number verified alert list me nahi hai.",
            mobileVerifiedForWhatsApp: false,
            updatedAt: FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

        results.push({
          registrationId: doc.id,
          rollNo: reg.rollNo,
          yearPart: reg.yearPart,
          mobile,
          skipped: true,
          reason: "mobile_not_verified_for_whatsapp"
        });
        continue;
      }

      const notificationId = makeNotificationId({
        rollNo: reg.rollNo,
        yearPart: reg.yearPart,
        resultType: reg.resultType || "MAIN",
        targetYear,
        formUrl
      });

      const notificationRef = db
        .collection("registered_result_update_notifications")
        .doc(notificationId);

      const notificationSnap = await notificationRef.get();

      if (notificationSnap.exists && !force) {
        skipped += 1;
        results.push({
          registrationId: doc.id,
          notificationId,
          rollNo: reg.rollNo,
          yearPart: reg.yearPart,
          mobile,
          skipped: true,
          reason: "already_sent"
        });
        continue;
      }

      const title = `${reg.yearPart || "PDUSU Result"} ${targetYear}`.trim();

      if (dryRun) {
        skipped += 1;
        results.push({
          registrationId: doc.id,
          notificationId,
          rollNo: reg.rollNo,
          yearPart: reg.yearPart,
          mobile,
          dryRun: true,
          wouldSend: true
        });
        continue;
      }

      try {
        const sendResult = await sendRegisteredUpdateTemplate({
          to: mobile,
          title,
          resultLink: formUrl,
          mainPortal:
            process.env.MAIN_EXAM_PORTAL ||
            OFFICIAL_MAIN_PORTAL ||
            "https://shekhauniexam.in/"
        });

        await notificationRef.set(
          {
            notificationId,
            registrationId: doc.id,
            rollNo: reg.rollNo || "",
            yearPart: reg.yearPart || "",
            resultType: reg.resultType || "MAIN",
            targetYear,
            mobile,
            formUrl,
            title,
            sendResult,
            sentAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

        await doc.ref.set(
          {
            registeredUpdateWhatsAppSent: true,
            registeredUpdateWhatsAppSentAt: FieldValue.serverTimestamp(),
            registeredUpdateWhatsAppSkipped: false,
            registeredUpdateWhatsAppSkipReason: "",
            mobileVerifiedForWhatsApp: true,
            updatedAt: FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

        sent += 1;

        results.push({
          registrationId: doc.id,
          notificationId,
          rollNo: reg.rollNo,
          yearPart: reg.yearPart,
          mobile,
          sent: true,
          method: sendResult.method
        });
      } catch (err) {
        skipped += 1;

        await doc.ref.set(
          {
            registeredUpdateWhatsAppSent: false,
            registeredUpdateWhatsAppLastError: err.message || "send failed",
            mobileVerifiedForWhatsApp: true,
            updatedAt: FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

        results.push({
          registrationId: doc.id,
          notificationId,
          rollNo: reg.rollNo,
          yearPart: reg.yearPart,
          mobile,
          sent: false,
          error: err.message || "send failed"
        });
      }
    }

    return res.status(200).json({
      success: true,
      dryRun,
      force,
      targetYear,
      activeFormUrls,
      forms,
      processed,
      sent,
      skipped,
      results
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
