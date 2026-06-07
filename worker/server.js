import express from "express";
import { chromium } from "playwright";

const app = express();

app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

function requireWorkerSecret(req, res, next) {
  const secret =
    req.query.secret ||
    req.headers["x-worker-secret"] ||
    req.body?.workerSecret;

  if (!process.env.WORKER_SECRET || secret !== process.env.WORKER_SECRET) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized worker request"
    });
  }

  next();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeTelegram(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function detectResultStatus(text, rollNo = "") {
  const clean = cleanText(text);
  const lower = clean.toLowerCase();

  if (
    lower.includes("captcha") ||
    lower.includes("verification code") ||
    lower.includes("security code")
  ) {
    return {
      status: "captcha_detected",
      resultFound: false,
      reason: "Captcha/manual verification detected"
    };
  }

  const notFoundWords = [
    "record not found",
    "not found",
    "result not declared",
    "invalid roll",
    "no record found",
    "please select",
    "enter roll"
  ];

  for (const word of notFoundWords) {
    if (lower.includes(word)) {
      return {
        status: "not_found",
        resultFound: false,
        reason: word
      };
    }
  }

  const strongWords = [
    "student name",
    "father",
    "mother",
    "roll no",
    "rollno",
    "enrollment",
    "marks",
    "total",
    "result",
    "pass",
    "fail",
    "promoted",
    "sgpa",
    "cgpa"
  ];

  let hits = 0;

  for (const word of strongWords) {
    if (lower.includes(word)) hits += 1;
  }

  if (rollNo && lower.includes(String(rollNo).toLowerCase())) {
    hits += 2;
  }

  if (hits >= 4 && clean.length > 200) {
    return {
      status: "result_found",
      resultFound: true,
      reason: `strong keywords matched: ${hits}`
    };
  }

  return {
    status: "unknown",
    resultFound: false,
    reason: "No clear result signature"
  };
}

async function selectDropdownByLabel(page, index, wantedLabel) {
  const selects = page.locator("select");
  const count = await selects.count();

  if (count <= index) {
    throw new Error(`Select dropdown index ${index} not found`);
  }

  const select = selects.nth(index);

  const options = await select.locator("option").evaluateAll((opts) =>
    opts.map((opt) => ({
      value: opt.value,
      label: opt.textContent?.replace(/\s+/g, " ").trim() || ""
    }))
  );

  const wanted = cleanText(wantedLabel).toLowerCase();

  let match =
    options.find((opt) => cleanText(opt.label).toLowerCase() === wanted) ||
    options.find((opt) => cleanText(opt.value).toLowerCase() === wanted) ||
    options.find((opt) =>
      cleanText(`${opt.label} ${opt.value}`).toLowerCase().includes(wanted)
    );

  if (!match) {
    throw new Error(
      `Dropdown option not found: ${wantedLabel}. Available: ${options
        .map((o) => o.label || o.value)
        .slice(0, 20)
        .join(", ")}`
    );
  }

  await select.selectOption(match.value || { label: match.label });

  return match;
}

async function fillRollNumber(page, rollNo) {
  const inputs = page.locator("input");
  const count = await inputs.count();

  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);

    const type = await input.getAttribute("type");
    const name = await input.getAttribute("name");
    const id = await input.getAttribute("id");
    const placeholder = await input.getAttribute("placeholder");

    const hay = `${type || ""} ${name || ""} ${id || ""} ${
      placeholder || ""
    }`.toLowerCase();

    if (type === "hidden") continue;

    if (hay.includes("roll")) {
      await input.fill(String(rollNo));
      return {
        index: i,
        name,
        id
      };
    }
  }

  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    const type = await input.getAttribute("type");

    if (type === "hidden" || type === "submit" || type === "button") continue;

    const visible = await input.isVisible().catch(() => false);

    if (visible) {
      await input.fill(String(rollNo));
      return {
        index: i
      };
    }
  }

  throw new Error("Roll number input not found");
}

async function clickShowResult(page) {
  const buttonTexts = [
    "Show Result",
    "SHOW RESULT",
    "Submit",
    "SUBMIT",
    "Result",
    "RESULT"
  ];

  for (const text of buttonTexts) {
    const btn = page.getByText(text, { exact: false }).first();
    const visible = await btn.isVisible().catch(() => false);

    if (visible) {
      await btn.click();
      return {
        method: "text",
        text
      };
    }
  }

  const inputs = page.locator("input");
  const count = await inputs.count();

  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    const type = await input.getAttribute("type");
    const value = await input.getAttribute("value");

    const hay = `${type || ""} ${value || ""}`.toLowerCase();

    if (
      hay.includes("submit") ||
      hay.includes("button") ||
      hay.includes("show") ||
      hay.includes("result")
    ) {
      await input.click();
      return {
        method: "input",
        index: i,
        value
      };
    }
  }

  throw new Error("Show Result button not found");
}

async function sendTelegramPhoto({ buffer, caption }) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN missing in worker");
  }

  if (!process.env.TELEGRAM_PUBLIC_CHAT_ID) {
    throw new Error("TELEGRAM_PUBLIC_CHAT_ID missing in worker");
  }

  const form = new FormData();

  form.append("chat_id", process.env.TELEGRAM_PUBLIC_CHAT_ID);
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append(
    "photo",
    new Blob([buffer], {
      type: "image/png"
    }),
    "result.png"
  );

  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
    {
      method: "POST",
      body: form
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.description || "Telegram sendPhoto failed");
  }

  return data.result;
}

async function sendTelegramText(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN missing in worker");
  }

  if (!process.env.TELEGRAM_PUBLIC_CHAT_ID) {
    throw new Error("TELEGRAM_PUBLIC_CHAT_ID missing in worker");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_PUBLIC_CHAT_ID,
        text,
        parse_mode: "HTML"
      })
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.description || "Telegram sendMessage failed");
  }

  return data.result;
}

function buildCaption({ rollNo, yearPart, resultType }) {
  return [
    "✅ <b>Result Found</b>",
    "",
    `<b>Roll No:</b> ${escapeTelegram(rollNo)}`,
    `<b>Course:</b> ${escapeTelegram(yearPart)}`,
    `<b>Type:</b> ${escapeTelegram(resultType || "MAIN")}`,
    "",
    "Source: Official University Result Portal",
    `Fetched At: ${new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata"
    })}`
  ].join("\n");
}

async function fetchResultWithBrowser({
  formUrl,
  yearPart,
  resultType,
  rollNo,
  sendTelegram = false
}) {
  if (!formUrl) throw new Error("formUrl required");
  if (!yearPart) throw new Error("yearPart required");
  if (!rollNo) throw new Error("rollNo required");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  let page;

  try {
    page = await browser.newPage({
      viewport: {
        width: 1365,
        height: 1600
      },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    });

    await page.goto(formUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(1200);

    const pageTitle = await page.title().catch(() => "");

    const yearSelection = await selectDropdownByLabel(page, 0, yearPart);
    const resultTypeSelection = await selectDropdownByLabel(
      page,
      1,
      resultType || "MAIN"
    );

    const rollInput = await fillRollNumber(page, rollNo);

    await page.waitForTimeout(500);

    const clickInfo = await clickShowResult(page);

    await page.waitForLoadState("domcontentloaded", {
      timeout: 30000
    }).catch(() => null);

    await page.waitForTimeout(3500);

    const text = await page.locator("body").innerText({
      timeout: 20000
    });

    const status = detectResultStatus(text, rollNo);

    const screenshot = await page.screenshot({
      fullPage: true,
      type: "png"
    });

    let telegramResult = null;
    let telegramSent = false;

    if (sendTelegram && status.resultFound) {
      telegramResult = await sendTelegramPhoto({
        buffer: screenshot,
        caption: buildCaption({
          rollNo,
          yearPart,
          resultType
        })
      });

      telegramSent = true;
    }

    if (sendTelegram && !status.resultFound) {
      await sendTelegramText(
        [
          "⚠️ <b>Result Test Completed</b>",
          "",
          `<b>Roll No:</b> ${escapeTelegram(rollNo)}`,
          `<b>Course:</b> ${escapeTelegram(yearPart)}`,
          `<b>Status:</b> ${escapeTelegram(status.status)}`,
          `<b>Reason:</b> ${escapeTelegram(status.reason)}`,
          "",
          `<b>Preview:</b> ${escapeTelegram(text.slice(0, 1200))}`
        ].join("\n")
      );
    }

    return {
      success: true,
      status: status.status,
      resultFound: status.resultFound,
      reason: status.reason,
      textPreview: cleanText(text).slice(0, 2500),
      pageTitle,
      selected: {
        yearSelection,
        resultTypeSelection,
        rollInput,
        clickInfo
      },
      telegramSent,
      telegramMessageId: telegramResult?.message_id || null
    };
  } finally {
    await browser.close();
  }
}

app.get("/", (_req, res) => {
  res.json({
    success: true,
    service: "Apni Library Result Worker",
    status: "running"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    status: "healthy"
  });
});

app.get("/test-result", requireWorkerSecret, async (req, res) => {
  try {
    const result = await fetchResultWithBrowser({
      formUrl:
        req.query.formUrl || "https://result25.shekhauni.co.in/NEP_RESULT.aspx",
      yearPart: req.query.yearPart,
      resultType: req.query.resultType || "MAIN",
      rollNo: req.query.rollNo,
      sendTelegram: req.query.sendTelegram === "true"
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/fetch-result", requireWorkerSecret, async (req, res) => {
  try {
    const result = await fetchResultWithBrowser({
      formUrl: req.body.formUrl,
      yearPart: req.body.yearPart,
      resultType: req.body.resultType || "MAIN",
      rollNo: req.body.rollNo,
      sendTelegram: Boolean(req.body.sendTelegram)
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Result worker running on port ${PORT}`);
});
