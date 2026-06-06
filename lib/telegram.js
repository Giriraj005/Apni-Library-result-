import { logEvent } from "./logger";

function getBotToken() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing");
  }

  return process.env.TELEGRAM_BOT_TOKEN;
}

export async function sendTelegramMessage({
  chatId,
  text,
  parseMode = "HTML"
}) {
  const token = getBotToken();
  const targetChatId = chatId || process.env.TELEGRAM_PUBLIC_CHAT_ID;

  if (!targetChatId) {
    throw new Error("Telegram chat id is missing");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: targetChatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true
    })
  });

  const data = await res.json();

  if (!data.ok) {
    await logEvent("telegram", "error", "Telegram sendMessage failed", data);
    throw new Error(data.description || "Telegram message failed");
  }

  return data.result;
}

export async function sendTelegramPhoto({ chatId, photoUrl, caption }) {
  const token = getBotToken();
  const targetChatId = chatId || process.env.TELEGRAM_PUBLIC_CHAT_ID;

  if (!targetChatId) {
    throw new Error("Telegram chat id is missing");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: targetChatId,
      photo: photoUrl,
      caption,
      parse_mode: "HTML"
    })
  });

  const data = await res.json();

  if (!data.ok) {
    await logEvent("telegram", "error", "Telegram sendPhoto failed", data);
    throw new Error(data.description || "Telegram photo failed");
  }

  return data.result;
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
