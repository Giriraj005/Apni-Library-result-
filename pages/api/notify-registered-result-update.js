import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireCron, safeJsonError } from "../../lib/security";
import {
  OFFICIAL_MAIN_PORTAL,
  RESULT_FORM_CANDIDATES
} from "../../lib/resultCourseCatalog";
import { validateResultLink } from "../../lib/resultLinkValidator";
import { logEvent } from "../../lib/logger";

const DEFAULT_LIMIT = 200;

function normalizeWhatsAppNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length === 10) return `91${digits}`;

  return digits;
}

function cleanId(value) {
  return String(value || "")
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);
}

function trimTemplateText(value, max = 900) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (text.length <= max) return text;

  return `${text.slice(0, max - 3)}...`;
}

async function sendTemplateToUser({ to, title, resultLink, mainPortal }) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is missing");
  }

  if (!token) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is missing");
  }

  const templateName =
    process.env.WHATSAPP_REGISTERED_UPDATE_TEMPLATE_NAME ||
    "pdusu_result_update_v2";

  const languageCode =
    process.env.WHATSAPP_REGISTERED_UPDATE_TEMPLATE_LANG || "en_US";

  const recipient = normalizeWhatsAppNumber(to);

  if (!recipient) {
    throw new Error("Recipient WhatsApp number is missing");
  }

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: trimTemplateText(title)
                },
                {
                  type: "text",
                  text: trimTemplateText(resultLink)
                },
                {
                  type: "text",
                  text: trimTemplateText(mainPortal)
                }
              ]
            }
          ]
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.error?.error_data?.details ||
        "WhatsApp registered update send failed"
    );
  }

  return data;
}

async function getActiveForms() {
  const forms = [];

  for (const form of RESULT_FORM_CANDIDATES) {
    try {
      const validation = await validateResultLink(form.url);

      forms.push({
        ...form,
        valid: Boolean(validation.valid),
        reason: validation.reason || "",
        status: validation.status || null
      });
    } catch (err) {
      forms.push({
        ...form,
        valid: false,
        reason: err.message || "validation_failed",
        status: null
      });
    }
  }

  return forms;
}

function shouldSendToRegistration(reg, activeFormUrls) {
  if (!reg.mobile) return false;

  if (reg.consentWhatsAppResult === false) return false;

  if (!reg.formUrl) return false;

  return activeFormUrls.includes(reg.formUrl);
}

function makeNotificationId({ rollNo, yearPart, formUrl }) {
  const targetYear = process.env.TARGET_RESULT_YEAR || "2025-26";

  return `registered_result_update_${cleanId(targetYear)}_${cleanId(
    rollNo
  )}_${cleanId(yearPart)}_${cleanId(formUrl)}`;
}

export default async function handler(req, res) {
  try {
    requireCron(req);

    const force = String(req.query.force || "") === "1";
    const dryRun = String(req.query.dry || "") === "1";
    const limit = Math.min(
      Number(req.query.limit || DEFAULT_LIMIT) || DEFAULT_LIMIT,
      500
    );

    const activeForms = await getActiveForms();
    const activeFormUrls = activeForms
      .filter((form) => form.valid)
      .map((form) => form.url);

    if (!activeFormUrls.length) {
      return res.status(200).json({
        success: true,
        mode: "notify_registered_result_update",
        sent: 0,
        failed: 0,
        skipped: 0,
        activeFormUrls: [],
        forms: activeForms,
        reason: "no_active_result_forms"
      });
    }

    const regSnap = await db
      .collection("result_registrations")
      .limit(limit)
      .get();

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const results = [];

    for (const doc of regSnap.docs) {
      const reg = doc.data();

      if (!shouldSendToRegistration(reg, activeFormUrls)) {
        skipped += 1;
        continue;
      }

      const notificationId = makeNotificationId({
        rollNo: reg.rollNo,
        yearPart: reg.yearPart,
        formUrl: reg.formUrl
      });

      const notifyRef = db
        .collection("registered_result_update_notifications")
        .doc(notificationId);

      const notifySnap = await notifyRef.get();

      if (!force && notifySnap.exists && notifySnap.data()?.sent) {
        skipped += 1;

        results.push({
          registrationId: doc.id,
          rollNo: reg.rollNo,
          yearPart: reg.yearPart,
          status: "already_sent"
        });

        continue;
      }

      const title = `${reg.yearPart || "PDUSU Result"} ${
        process.env.TARGET_RESULT_YEAR || "2025-26"
      }`;

      if (dryRun) {
        skipped += 1;

        results.push({
          registrationId: doc.id,
          rollNo: reg.rollNo,
          yearPart: reg.yearPart,
          mobile: reg.mobile,
          status: "dry_run",
          title,
          resultLink: reg.formUrl
        });

        continue;
      }

      try {
        const whatsapp = await sendTemplateToUser({
          to: reg.mobile,
          title,
          resultLink: reg.formUrl,
          mainPortal: OFFICIAL_MAIN_PORTAL
        });

        await notifyRef.set(
          {
            type: "registered_result_update",
            registrationId: doc.id,
            rollNo: reg.rollNo || "",
            mobile: reg.mobile || "",
            yearPart: reg.yearPart || "",
            formUrl: reg.formUrl || "",
            title,
            sent: true,
            whatsapp,
            sentAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

        await doc.ref.set(
          {
            registeredResultUpdateSent: true,
            registeredResultUpdateSentAt: FieldValue.serverTimestamp(),
            registeredResultUpdateWhatsApp: whatsapp,
            updatedAt: FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

        sent += 1;

        results.push({
          registrationId: doc.id,
          rollNo: reg.rollNo,
          yearPart: reg.yearPart,
          mobile: normalizeWhatsAppNumber(reg.mobile),
          status: "sent"
        });
      } catch (err) {
        await notifyRef.set(
          {
            type: "registered_result_update",
            registrationId: doc.id,
            rollNo: reg.rollNo || "",
            mobile: reg.mobile || "",
            yearPart: reg.yearPart || "",
            formUrl: reg.formUrl || "",
            title,
            sent: false,
            error: err.message || "send_failed",
            updatedAt: FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

        failed += 1;

        results.push({
          registrationId: doc.id,
          rollNo: reg.rollNo,
          yearPart: reg.yearPart,
          mobile: normalizeWhatsAppNumber(reg.mobile),
          status: "failed",
          error: err.message
        });
      }
    }

    await logEvent(
      "registered_result_update_whatsapp",
      "info",
      "Registered result update WhatsApp completed",
      {
        sent,
        failed,
        skipped,
        activeFormUrls
      }
    );

    return res.status(200).json({
      success: true,
      mode: "notify_registered_result_update",
      template:
        process.env.WHATSAPP_REGISTERED_UPDATE_TEMPLATE_NAME ||
        "pdusu_result_update_v2",
      language:
        process.env.WHATSAPP_REGISTERED_UPDATE_TEMPLATE_LANG || "en_US",
      activeFormUrls,
      forms: activeForms,
      sent,
      failed,
      skipped,
      results
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
      }
