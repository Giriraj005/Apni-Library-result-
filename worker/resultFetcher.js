import { chromium } from "playwright";

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "");
}

function detectCaptcha(text) {
  const lower = String(text || "").toLowerCase();

  return (
    lower.includes("captcha") ||
    lower.includes("verification code") ||
    lower.includes("security code")
  );
}

function detectNotFound(text) {
  const lower = String(text || "").toLowerCase();

  const phrases = [
    "record not found",
    "not found",
    "no record",
    "invalid roll",
    "wrong roll",
    "result not declared",
    "enter roll",
    "please select"
  ];

  return phrases.find((phrase) => lower.includes(phrase)) || "";
}

function extractUsefulLines(text) {
  const lines = String(text || "")
    .split(/\n|\r|\|/)
    .map((line) => cleanText(line))
    .filter(Boolean);

  const useful = [];

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (
      lower.includes("student") ||
      lower.includes("name") ||
      lower.includes("father") ||
      lower.includes("mother") ||
      lower.includes("roll") ||
      lower.includes("enrol") ||
      lower.includes("subject") ||
      lower.includes("paper") ||
      lower.includes("marks") ||
      lower.includes("max") ||
      lower.includes("min") ||
      lower.includes("obt") ||
      lower.includes("total") ||
      lower.includes("result") ||
      lower.includes("sgpa") ||
      lower.includes("cgpa") ||
      lower.includes("pass") ||
      lower.includes("fail") ||
      lower.includes("promoted")
    ) {
      useful.push(line);
    }
  }

  return [...new Set(useful)].slice(0, 120);
}

function detectResultStatus({ text, rollNo }) {
  const lower = String(text || "").toLowerCase();

  if (detectCaptcha(text)) {
    return {
      status: "captcha_detected",
      resultFound: false,
      reason: "captcha_detected"
    };
  }

  const notFound = detectNotFound(text);

  if (notFound) {
    return {
      status: "not_found",
      resultFound: false,
      reason: notFound
    };
  }

  const resultKeywords = [
    "student name",
    "father",
    "mother",
    "roll no",
    "rollno",
    "enrollment",
    "subject",
    "paper",
    "marks",
    "obtained",
    "total",
    "result",
    "sgpa",
    "cgpa",
    "pass",
    "fail",
    "promoted"
  ];

  let hits = 0;

  for (const keyword of resultKeywords) {
    if (lower.includes(keyword)) hits += 1;
  }

  if (rollNo && lower.includes(String(rollNo).toLowerCase())) {
    hits += 2;
  }

  if (hits >= 4 && String(text || "").length > 250) {
    return {
      status: "result_found",
      resultFound: true,
      reason: `strong result signals: ${hits}`
    };
  }

  if (
    lower.includes("select year part") &&
    lower.includes("examination result") &&
    hits < 4
  ) {
    return {
      status: "form_returned",
      resultFound: false,
      reason: "form returned after click"
    };
  }

  return {
    status: "unknown",
    resultFound: false,
    reason: "no clear result signature"
  };
}

async function getDropdownOptions(page, selector) {
  return page.locator(selector).evaluate((select) => {
    return Array.from(select.options).map((option) => ({
      value: option.value,
      label: option.textContent.trim()
    }));
  });
}

async function selectDropdownByNormalizedText(page, selector, wantedText) {
  const options = await getDropdownOptions(page, selector);
  const target = normalize(wantedText);

  const exact = options.find(
    (option) =>
      normalize(option.label) === target || normalize(option.value) === target
  );

  if (exact) {
    await page.selectOption(selector, exact.value || { label: exact.label });
    return {
      selectedValue: exact.value,
      selectedLabel: exact.label,
      available: options.map((x) => x.label || x.value)
    };
  }

  const loose = options.find((option) => {
    const hay = normalize(`${option.label} ${option.value}`);
    return hay.includes(target) || target.includes(hay);
  });

  if (loose) {
    await page.selectOption(selector, loose.value || { label: loose.label });
    return {
      selectedValue: loose.value,
      selectedLabel: loose.label,
      available: options.map((x) => x.label || x.value)
    };
  }

  throw new Error(
    `Dropdown option not found: ${wantedText}. Available: ${options
      .map((x) => x.label || x.value)
      .join(", ")}`
  );
}

async function findFirstVisible(page, selectors) {
  for (const selector of selectors) {
    const loc = page.locator(selector).first();

    try {
      if ((await loc.count()) && (await loc.isVisible())) {
        return selector;
      }
    } catch {
      // ignore
    }
  }

  return "";
}

async function clickSubmit(page) {
  const submitSelectors = [
    "#btnSave",
    'input[name="btnSave"]',
    'input[type="submit"]',
    'button[type="submit"]',
    'input[value*="Show"]',
    'input[value*="Result"]',
    'input[value*="Submit"]',
    'button:has-text("Show")',
    'button:has-text("Result")',
    'button:has-text("Submit")'
  ];

  const selector = await findFirstVisible(page, submitSelectors);

  if (!selector) {
    throw new Error("Submit button not found");
  }

  await Promise.allSettled([
    page.waitForLoadState("networkidle", { timeout: 15000 }),
    page.locator(selector).first().click()
  ]);

  try {
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  } catch {
    // ignore
  }

  await page.waitForTimeout(2500);

  return selector;
}

async function extractTableText(page) {
  const tableTexts = await page.locator("table").evaluateAll((tables) => {
    return tables.map((table) => table.innerText || "").filter(Boolean);
  });

  return tableTexts.join("\n\n");
}

export async function fetchResultWithBrowser({
  rollNo,
  yearPart,
  resultType = "MAIN",
  formUrl
}) {
  let browser = null;

  const startedAt = Date.now();

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process"
      ]
    });

    const context = await browser.newContext({
      viewport: {
        width: 1366,
        height: 768
      },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    });

    const page = await context.newPage();

    page.setDefaultTimeout(25000);

    await page.goto(formUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForLoadState("networkidle", {
      timeout: 20000
    }).catch(() => {});

    const yearSelectSelector =
      (await findFirstVisible(page, [
        "#DDL_RESULT",
        'select[name="DDL_RESULT"]',
        "select"
      ])) || "select";

    const selected = await selectDropdownByNormalizedText(
      page,
      yearSelectSelector,
      yearPart
    );

    const rollSelector = await findFirstVisible(page, [
      "#txtfromNo",
      'input[name="txtfromNo"]',
      "#txtRollNo",
      'input[name="txtRollNo"]',
      'input[id*="Roll" i]',
      'input[name*="Roll" i]',
      'input[type="text"]'
    ]);

    if (!rollSelector) {
      throw new Error("Roll number input not found");
    }

    await page.locator(rollSelector).first().fill(String(rollNo));

    const clickedSelector = await clickSubmit(page);

    const bodyText = stripText(await page.locator("body").innerText());
    const tableText = stripText(await extractTableText(page));

    const combinedText = stripText([bodyText, tableText].filter(Boolean).join("\n\n"));

    const status = detectResultStatus({
      text: combinedText,
      rollNo
    });

    const usefulLines = extractUsefulLines(combinedText);

    const marksSummary = usefulLines.length
      ? usefulLines.join("\n")
      : combinedText.slice(0, 3500);

    const screenshotBase64 =
      process.env.INCLUDE_SCREENSHOT === "true"
        ? await page.screenshot({
            fullPage: true,
            type: "png"
          }).then((buffer) => buffer.toString("base64"))
        : null;

    await browser.close();

    return {
      success: true,
      rollNo,
      yearPart,
      resultType,
      formUrl,
      resultFound: status.resultFound,
      resultStatus: status.status,
      reason: status.reason,
      selected: {
        dropdownSelector: yearSelectSelector,
        selectedValue: selected.selectedValue,
        selectedLabel: selected.selectedLabel,
        rollSelector,
        clickedSelector
      },
      marksSummary,
      textPreview: combinedText.slice(0, 3500),
      screenshotBase64,
      durationMs: Date.now() - startedAt
    };
  } catch (err) {
    if (browser) {
      await browser.close().catch(() => {});
    }

    return {
      success: false,
      error: err.message || "Browser worker failed",
      rollNo,
      yearPart,
      resultType,
      formUrl,
      durationMs: Date.now() - startedAt
    };
  }
      }
