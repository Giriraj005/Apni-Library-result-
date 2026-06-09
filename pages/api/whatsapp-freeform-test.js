import { requireAdmin, safeJsonError } from "../../lib/security";

function normalizeWhatsAppNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length === 10) return `91${digits}`;

  return digits;
}

async function sendFreeformWhatsAppText({ to, text }) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is missing");
  }

  if (!token) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is missing");
  }

  const recipient = normalizeWhatsAppNumber(to);

  if (!recipient) {
    throw new Error("Recipient number is missing");
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
        type: "text",
        text: {
          preview_url: true,
          body: text
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.error?.error_data?.details ||
        "Freeform WhatsApp message failed"
    );
  }

  return data;
}

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const to = req.query.to || req.body?.to;

    const text =
      req.query.text ||
      req.body?.text ||
      [
        "✅ PDUSU Result Found",
        "",
        "Roll No: 26331464",
        "Course: M.COM ABST SEMESTER I",
        "",
        "Result Summary:",
        "Total Marks: 387/600, SGPA: 6.72, Result: PAPR",
        "",
        "Official Result Link:",
        "https://result26.shekhauniexam.in/PG_NEP_RESULT.aspx",
        "",
        "Please verify your full marksheet from the official university website.",
        "",
        "Apni Library"
      ].join("\n");

    const result = await sendFreeformWhatsAppText({
      to,
      text
    });

    return res.status(200).json({
      success: true,
      to: normalizeWhatsAppNumber(to),
      result
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
