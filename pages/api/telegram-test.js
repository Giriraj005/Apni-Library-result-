import { requireAdmin, safeJsonError } from "../../lib/security";
import { sendTelegramMessage } from "../../lib/telegram";
import { logEvent } from "../../lib/logger";

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const message =
      req.body?.message || "✅ Apni Library Result Alert Telegram test successful.";

    const publicResult = await sendTelegramMessage({
      chatId: process.env.TELEGRAM_PUBLIC_CHAT_ID,
      text: message
    });

    let adminResult = null;

    if (
      process.env.TELEGRAM_ADMIN_CHAT_ID &&
      process.env.TELEGRAM_ADMIN_CHAT_ID !== process.env.TELEGRAM_PUBLIC_CHAT_ID
    ) {
      adminResult = await sendTelegramMessage({
        chatId: process.env.TELEGRAM_ADMIN_CHAT_ID,
        text: `Admin copy:\n${message}`
      });
    }

    await logEvent("telegram", "info", "Telegram test message sent", {
      publicMessageId: publicResult.message_id
    });

    return res.status(200).json({
      success: true,
      publicMessageId: publicResult.message_id,
      adminMessageId: adminResult?.message_id || null
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
