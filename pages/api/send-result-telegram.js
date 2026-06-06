import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireAdmin, safeJsonError } from "../../lib/security";
import {
  resultCaption,
  sendTelegramMessage,
  sendTelegramPhoto
} from "../../lib/telegram";

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const { resultId } = req.body || {};

    if (!resultId) {
      return res.status(400).json({
        success: false,
        error: "resultId required"
      });
    }

    const ref = db.collection("result_outputs").doc(resultId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: "Result output not found"
      });
    }

    const data = snap.data();

    if (data.telegramSent) {
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: "Already sent"
      });
    }

    const caption = resultCaption({
      rollNo: data.rollNo,
      yearPart: data.yearPart,
      resultType: data.resultType
    });

    let telegramResult;

    if (data.screenshotUrl) {
      telegramResult = await sendTelegramPhoto({
        chatId: process.env.TELEGRAM_PUBLIC_CHAT_ID,
        photoUrl: data.screenshotUrl,
        caption
      });
    } else {
      telegramResult = await sendTelegramMessage({
        chatId: process.env.TELEGRAM_PUBLIC_CHAT_ID,
        text: `${caption}\n\n${escapeTelegram(
          (data.textPreview || data.resultText || "").slice(0, 2500)
        )}`
      });
    }

    await ref.set(
      {
        telegramSent: true,
        telegramSentAt: FieldValue.serverTimestamp(),
        telegramMessageId: telegramResult.message_id || null
      },
      {
        merge: true
      }
    );

    return res.status(200).json({
      success: true,
      messageId: telegramResult.message_id || null
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}

function escapeTelegram(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
