import { requireAdmin, safeJsonError } from "../../lib/security";
import { sendTelegramMessage } from "../../lib/telegram";
import { sendWhatsAppResultAlertToAdmins } from "../../lib/whatsapp";
import { logEvent } from "../../lib/logger";
import {
  OFFICIAL_MAIN_PORTAL,
  validateResultLink,
  buildResultInstruction
} from "../../lib/resultLinkValidator";

const DEFAULT_DETECTED_RESULT_LINK =
  "https://result26.shekhauniexam.in/(S(nq1vaahpmmzmjtrf1baovmbo))/RESULTS.aspx";

function safeString(value, fallback = "") {
  if (typeof value === "string" && value.trim()) return value.trim();

  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0].trim();
  }

  return fallback;
}

function buildWhatsAppShareLink(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function buildAlertMessage({ title, displayUrl, originalUrl, validatedLink }) {
  const instruction = buildResultInstruction(validatedLink);

  const plain = [
    "PDUSU Result 2025-26 Portal Detected",
    "",
    `Title: ${title}`,
    "",
    `Official Link: ${displayUrl}`,
    validatedLink?.valid ? "" : "Note: Direct result link may expire, so use the official exam portal link above.",
    "",
    instruction,
    "",
    originalUrl && originalUrl !== displayUrl
      ? `Detected Link: ${originalUrl}`
      : "",
    "Source: Official University Result Portal"
  ]
    .filter(Boolean)
    .join("\n");

  const shareLink = buildWhatsAppShareLink(plain);

  return [
    "🎓 <b>PDUSU Result 2025-26 Portal Detected</b>",
    "",
    "University ki official exam site par 2025-26 result portal/link detect hua hai.",
    "",
    `<b>Title:</b> ${title}`,
    "",
    "<b>Official Link:</b>",
    displayUrl,
    "",
    validatedLink?.valid
      ? ""
      : "⚠️ Direct result session link expire/server error de sakta hai. Isliye safe official portal link share kiya gaya hai.",
    "",
    `<b>Instruction:</b>`,
    instruction,
    "",
    originalUrl && originalUrl !== displayUrl
      ? `<b>Detected Result Link:</b>\n${originalUrl}`
      : "",
    "",
    "<b>WhatsApp Share:</b>",
    shareLink,
    "",
    "Source: Official University Result Portal"
  ]
    .filter(Boolean)
    .join("\n");
}

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const title = safeString(
      req.query.title || req.body?.title,
      "PDUSU Result 2025-26"
    );

    const inputUrl = safeString(
      req.query.resultUrl ||
        req.query.url ||
        req.body?.resultUrl ||
        req.body?.url,
      DEFAULT_DETECTED_RESULT_LINK
    );

    const validatedLink = await validateResultLink(inputUrl);

    const displayUrl = validatedLink.valid
      ? validatedLink.safeUrl
      : OFFICIAL_MAIN_PORTAL;

    const telegramMessage = buildAlertMessage({
      title,
      displayUrl,
      originalUrl: validatedLink.originalUrl || inputUrl,
      validatedLink
    });

    const telegram = await sendTelegramMessage({
      chatId: process.env.TELEGRAM_PUBLIC_CHAT_ID,
      text: telegramMessage
    });

    let whatsapp = null;

    try {
      whatsapp = await sendWhatsAppResultAlertToAdmins({
        title,
        link: displayUrl
      });
    } catch (err) {
      whatsapp = {
        success: false,
        error: err.message
      };
    }

    await logEvent("manual_result_alert", "warn", "Manual result alert sent", {
      title,
      inputUrl,
      displayUrl,
      validatedLink,
      telegramMessageId: telegram?.message_id || null,
      whatsapp
    });

    return res.status(200).json({
      success: true,
      title,
      inputUrl,
      displayUrl,
      validatedLink,
      telegramMessageId: telegram?.message_id || null,
      whatsapp
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
