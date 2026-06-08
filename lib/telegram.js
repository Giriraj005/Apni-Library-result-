import { logEvent } from "./logger";

function getBotToken() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing");
  }

  return process.env.TELEGRAM_BOT_TOKEN;
}

function parseChatIds(value) {
  return String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function getTargetChatIds(chatId) {
  const input = chatId || process.env.TELEGRAM_PUBLIC_CHAT_ID;

  const ids = parseChatIds(input);

  if (!ids.length) {
    throw new Error("Telegram chat id is missing");
  }

  return [...new Set(ids)];
}

async function sendSingleTelegramMessage({
  token,
  chatId,
  text,
  parseMode = "HTML"
}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true
    })
  });

  const data = await res.json();

  if (!data.ok) {
    await logEvent("telegram", "error", "Telegram sendMessage failed", {
      chatId,
      data
    });

    throw new Error(data.description || "Telegram message failed");
  }

  return data.result;
}

async function sendSingleTelegramPhoto({
  token,
  chatId,
  photoUrl,
  caption
}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "HTML"
    })
  });

  const data = await res.json();

  if (!data.ok) {
    await logEvent("telegram", "error", "Telegram sendPhoto failed", {
      chatId,
      data
    });

    throw new Error(data.description || "Telegram photo failed");
  }

  return data.result;
}

export async function sendTelegramMessage({
  chatId,
  text,
  parseMode = "HTML"
}) {
  const token = getBotToken();
  const chatIds = getTargetChatIds(chatId);

  const results = [];

  for (const targetChatId of chatIds) {
    try {
      const result = await sendSingleTelegramMessage({
        token,
        chatId: targetChatId,
        text,
        parseMode
      });

      results.push({
        chatId: targetChatId,
        success: true,
        message_id: result.message_id,
        result
      });
    } catch (err) {
      results.push({
        chatId: targetChatId,
        success: false,
        error: err.message
      });
    }
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  if (!sent) {
    throw new Error(
      `Telegram message failed for all chats: ${results
        .map((r) => `${r.chatId}: ${r.error}`)
        .join(" | ")}`
    );
  }

  await logEvent("telegram", "info", "Telegram message sent", {
    total: chatIds.length,
    sent,
    failed,
    results
  });

  return {
    message_id: results.find((r) => r.success)?.message_id || null,
    total: chatIds.length,
    sent,
    failed,
    results
  };
}

export async function sendTelegramPhoto({ chatId, photoUrl, caption }) {
  const token = getBotToken();
  const chatIds = getTargetChatIds(chatId);

  const results = [];

  for (const targetChatId of chatIds) {
    try {
      const result = await sendSingleTelegramPhoto({
        token,
        chatId: targetChatId,
        photoUrl,
        caption
      });

      results.push({
        chatId: targetChatId,
        success: true,
        message_id: result.message_id,
        result
      });
    } catch (err) {
      results.push({
        chatId: targetChatId,
        success: false,
        error: err.message
      });
    }
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  if (!sent) {
    throw new Error(
      `Telegram photo failed for all chats: ${results
        .map((r) => `${r.chatId}: ${r.error}`)
        .join(" | ")}`
    );
  }

  await logEvent("telegram", "info", "Telegram photo sent", {
    total: chatIds.length,
    sent,
    failed,
    results
  });

  return {
    message_id: results.find((r) => r.success)?.message_id || null,
    total: chatIds.length,
    sent,
    failed,
    results
  };
}

export function resultCaption({ rollNo, yearPart, resultType, fetchedAt }) {
  return [
    "✅ <b>Result Found</b>",
    "",
    `<b>Roll No:</b> ${rollNo}`,
    `<b>Course:</b> ${yearPart}`,
    `<b>Type:</b> ${resultType || "MAIN"}`,
    "",
    "Source: Official University Result Portal",
    `Fetched At: ${
      fetchedAt ||
      new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata"
      })
    }`
  ].join("\n");
}
