import { requireAdmin, safeJsonError } from "../../lib/security";
import { sendTelegramMessage } from "../../lib/telegram";
import { sendWhatsAppResultAlertToAdmins } from "../../lib/whatsapp";
import { logEvent } from "../../lib/logger";

function buildWhatsAppShareLink(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function buildAlertMessage({ title, link }) {
  const plain = [
    "PDUSU Result 2025-26 Portal Detected",
    "",
    `Title: ${title}`,
    "",
    `Official Link: ${link}`,
    "",
    "Students official portal par apna roll number check karein.",
    "Source: Official University Result Portal"
  ].join("\n");

  const shareLink = buildWhatsAppShareLink(plain);

  return [
    "🎓 <b>PDUSU Result 2025-26 Portal Detected</b>",
    "",
    "University ki official exam site par 2025-26 result portal/link detect hua hai.",
    "",
    `<b>Title:</b> ${title}`,
    "",
    "<b>Open Official Result Link:</b>",
    link,
    "",
    "<b>WhatsApp Share:</b>",
    shareLink,
    "",
    "Students apna roll number official portal par check karein.",
    "",
    "Source: Official University Result Portal"
  ].join("\n");
}

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const title =
      req.query.title ||
      req.body?.title ||
      "PDUSU Result 2025-26";

    const link =
      req.query.link ||
      req.body?.link ||
      "https://result26.shekhauniexam.in/(S(nq1vaahpmmzmjtrf1baovmbo))/RESULTS.aspx";

    const telegramMessage = buildAlertMessage({ title, link });

    const telegram = await sendTelegramMessage({
      chatId: process.env.TELEGRAM_PUBLIC_CHAT_ID,
      text: telegramMessage
    });

    let whatsapp = null;

    try {
      whatsapp = await sendWhatsAppResultAlertToAdmins({
        title,
        link
      });
    } catch (err) {
      whatsapp = {
        success: false,
        error: err.message
      };
    }

    await logEvent("manual_result_alert", "warn", "Manual result alert sent", {
      title,
      link,
      telegramMessageId: telegram?.message_id || null,
      whatsapp
    });

    return res.status(200).json({
      success: true,
      title,
      link,
      telegramMessageId: telegram?.message_id || null,
      whatsapp
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
