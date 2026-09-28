import { chromium } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { randomUUID } from "node:crypto";

/*
 * CAPTCHA handling
 * ----------------
 * The university result page now shows a CAPTCHA. This file does NOT read or
 * solve it. A person always types it. Choose how with the `captchaMode` option
 * (or the CAPTCHA_MODE env var):
 *
 *   "skip"     (default) Detect the CAPTCHA, stop right away and return
 *              resultStatus "captcha_required" (needsHuman: true). Nothing is
 *              submitted, so there is nothing to retry.
 *   "prompt"   Headless. Fills the form, saves the CAPTCHA image, and asks a
 *              person for the text via `getCaptchaText` (defaults to a
 *              terminal prompt). Retries with a fresh CAPTCHA if it is rejected.
 *   "browser"  Opens a visible browser window with the form pre-filled. A
 *              person types the CAPTCHA and clicks "Show Result"; the script
 *              waits and scrapes the result. Needs a desktop/display.
 *
 * Process roll numbers one at a time in "prompt" and "browser" modes.
 */

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

async function setupFastPage(page, { allowImages = false } = {}) {
  // The CAPTCHA is an image, so a human-in-the-loop mode has to let images load.
  const blocked = allowImages ? ["font", "media"] : ["image", "font", "media"];

  await page.route("**/*", async (route) => {
    const resourceType = route.request().resourceType();

    if (blocked.includes(resourceType)) {
      return route.abort();
    }

    return route.continue();
  });
}

async function gotoResultPage(page, url) {
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });
  } catch {
    await page.goto(url, {
      waitUntil: "commit",
      timeout: 60000
    });
  }

  await page.waitForSelector("select", {
    timeout: 45000
  });

  await page.waitForTimeout(1200);
}

const CAPTCHA_INPUT_SELECTORS = [
  "#txtCaptcha",
  'input[name="txtCaptcha"]',
  'input[id*="captcha" i]',
  'input[name*="captcha" i]',
  'input[placeholder*="captcha" i]'
];

const CAPTCHA_IMAGE_SELECTORS = [
  "#imgCaptcha",
  'img[id*="captcha" i]',
  'img[src*="captcha" i]',
  'img[alt*="captcha" i]'
];

// Messages the site shows when a typed CAPTCHA is rejected or missing.
const CAPTCHA_ERROR_PHRASES = [
  "invalid captcha",
  "wrong captcha",
  "incorrect captcha",
  "captcha mismatch",
  "captcha does not match",
  "captcha not match",
  "captcha is required",
  "captcha required",
  "enter captcha",
  "enter the captcha"
];

function detectCaptchaError(text) {
  const lower = String(text || "").toLowerCase();

  return CAPTCHA_ERROR_PHRASES.find((phrase) => lower.includes(phrase)) || "";
}

// Looks at the page structure (input / image), not the words on the page,
// because the form always has a "CAPTCHA" label even after a good result.
async function hasCaptchaChallenge(page) {
  if (await findFirstVisible(page, CAPTCHA_INPUT_SELECTORS)) {
    return true;
  }

  for (const selector of CAPTCHA_IMAGE_SELECTORS) {
    try {
      if (await page.locator(selector).count()) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

async function readCaptchaImage(page) {
  const selector = await findFirstVisible(page, CAPTCHA_IMAGE_SELECTORS);

  if (selector) {
    try {
      await page.waitForFunction(
        (sel) => {
          const img = document.querySelector(sel);
          return !!img && img.complete && img.naturalWidth > 0;
        },
        selector,
        { timeout: 15000 }
      );

      // Screenshot the element itself: re-downloading the image URL would
      // usually generate a different CAPTCHA than the one on the page.
      const buffer = await page.locator(selector).first().screenshot({
        type: "png"
      });

      return { buffer, selector, fullPage: false };
    } catch {
      // fall through to a full-page screenshot
    }
  }

  return {
    buffer: await page.screenshot({ type: "png" }),
    selector: "",
    fullPage: true
  };
}

async function fillCaptchaField(page, text) {
  const selector = await findFirstVisible(page, CAPTCHA_INPUT_SELECTORS);

  if (!selector) {
    throw new Error("CAPTCHA input not found");
  }

  const field = page.locator(selector).first();

  await field.fill(String(text).trim());
  await field.dispatchEvent("input");
  await field.dispatchEvent("change");

  return selector;
}

// Default way to get a CAPTCHA answer: save the image, ask in the terminal.
// Pass your own `getCaptchaText` to show the image in your own UI instead.
async function promptCaptchaFromTerminal({ imageBuffer, rollNo, attempt }) {
  if (!process.stdin.isTTY) {
    throw new Error(
      "No interactive terminal for CAPTCHA entry. Pass getCaptchaText, or use captchaMode: 'browser' on a machine with a display."
    );
  }

  const file = path.join(os.tmpdir(), `captcha_${rollNo}_${Date.now()}.png`);
  await fs.writeFile(file, imageBuffer);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const answer = await rl.question(
      `[${rollNo}] Open ${file} and type the CAPTCHA (attempt ${attempt}, blank to skip): `
    );

    return answer.trim();
  } finally {
    rl.close();
    await fs.unlink(file).catch(() => {});
  }
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

// Words that only show up on a real result sheet, never on the search form.
const RESULT_ONLY_KEYWORDS = [
  "student name",
  "father",
  "mother",
  "obtained",
  "sgpa",
  "cgpa",
  "marks",
  "enrollment"
];

function detectResultStatus({ text, rollNo, captchaPresent = false }) {
  const lower = String(text || "").toLowerCase();

  // The site rejected (or did not get) the typed CAPTCHA.
  const captchaError = detectCaptchaError(text);

  if (captchaError) {
    return {
      status: "captcha_failed",
      resultFound: false,
      reason: captchaError
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

  const resultOnlyHits = RESULT_ONLY_KEYWORDS.filter((keyword) =>
    lower.includes(keyword)
  ).length;

  // A CAPTCHA box is still on screen and there is no result sheet: the form
  // is waiting for a CAPTCHA (or it was silently rejected).
  if (captchaPresent && resultOnlyHits < 2) {
    return {
      status: "captcha_required",
      resultFound: false,
      reason: "captcha_required"
    };
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
    await page.selectOption(selector, exact.value);
    await page.locator(selector).dispatchEvent("change");
    await page.waitForTimeout(800);

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
    await page.selectOption(selector, loose.value);
    await page.locator(selector).dispatchEvent("change");
    await page.waitForTimeout(800);

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

async function selectResultTypeIfAvailable(page, resultType) {
  const selects = await page.locator("select").evaluateAll((items) => {
    return items.map((select, index) => ({
      index,
      id: select.id || "",
      name: select.name || "",
      options: Array.from(select.options).map((option) => ({
        value: option.value,
        label: option.textContent.trim()
      }))
    }));
  });

  const typeSelect = selects.find((select) => {
    const hay = `${select.id} ${select.name} ${select.options
      .map((o) => `${o.label} ${o.value}`)
      .join(" ")}`.toLowerCase();

    return (
      hay.includes("main") ||
      hay.includes("reval") ||
      hay.includes("supp") ||
      hay.includes("result type")
    );
  });

  if (!typeSelect) {
    return {
      selected: false,
      reason: "result type dropdown not found"
    };
  }

  const selector = typeSelect.id
    ? `#${typeSelect.id}`
    : typeSelect.name
    ? `select[name="${typeSelect.name}"]`
    : `select >> nth=${typeSelect.index}`;

  const target = normalize(resultType || "MAIN");

  const exact =
    typeSelect.options.find((o) => normalize(o.label) === target) ||
    typeSelect.options.find((o) => normalize(o.value) === target) ||
    typeSelect.options.find((o) => normalize(o.label).includes(target)) ||
    typeSelect.options.find((o) => normalize(o.value).includes(target));

  if (!exact) {
    return {
      selected: false,
      selector,
      reason: "MAIN option not found",
      available: typeSelect.options
    };
  }

  await page.selectOption(selector, exact.value);
  await page.locator(selector).dispatchEvent("change");
  await page.waitForTimeout(500);

  return {
    selected: true,
    selector,
    value: exact.value,
    label: exact.label
  };
}

async function fillRollFields(page, rollNo) {
  const selectors = [
    "#txtfromNo",
    'input[name="txtfromNo"]',
    "#txtFromNo",
    'input[name="txtFromNo"]',
    "#txttoNo",
    'input[name="txttoNo"]',
    "#txtToNo",
    'input[name="txtToNo"]',
    "#txtRollNo",
    'input[name="txtRollNo"]',
    'input[id*="Roll" i]',
    'input[name*="Roll" i]',
    'input[type="text"]'
  ];

  const filled = [];

  for (const selector of selectors) {
    const loc = page.locator(selector);

    try {
      const count = await loc.count();

      for (let i = 0; i < count; i++) {
        const item = loc.nth(i);

        if (!(await item.isVisible())) continue;

        const currentValue = await item.inputValue().catch(() => "");
        const name = await item.getAttribute("name").catch(() => "");
        const id = await item.getAttribute("id").catch(() => "");
        const placeholder = await item
          .getAttribute("placeholder")
          .catch(() => "");

        // The generic input[type="text"] fallback below also matches the DOB
        // and CAPTCHA boxes. Leave those alone.
        if (/captcha|dob|birth|dd\/mm/i.test(`${id} ${name} ${placeholder}`)) {
          continue;
        }

        const key = `${id || ""}_${name || ""}_${i}`;

        if (filled.find((x) => x.key === key)) continue;

        await item.fill(String(rollNo));
        await item.dispatchEvent("input");
        await item.dispatchEvent("change");

        filled.push({
          key,
          selector,
          id,
          name,
          previousValue: currentValue
        });
      }
    } catch {
      // ignore
    }
  }

  if (!filled.length) {
    throw new Error("Roll number input not found");
  }

  return filled;
}

async function fillDobField(page, dob) {
  if (!dob) {
    return { filled: false, reason: "dob not provided" };
  }

  const selectors = [
    "#txtDOB",
    'input[name="txtDOB"]',
    "#txtDateOfBirth",
    'input[name="txtDateOfBirth"]',
    "#txtBirthDate",
    'input[name="txtBirthDate"]',
    'input[id*="DOB" i]',
    'input[name*="DOB" i]',
    'input[id*="Birth" i]',
    'input[name*="Birth" i]',
    'input[placeholder*="DD/MM/YYYY" i]'
  ];

  const selector = await findFirstVisible(page, selectors);

  if (!selector) {
    return { filled: false, reason: "date of birth input not found" };
  }

  const field = page.locator(selector).first();

  try {
    await field.fill(dob);
  } catch {
    // Some DOB inputs are readonly and driven by a datepicker widget —
    // set the value directly and fire the events the page listens for.
    await field.evaluate((el, value) => {
      el.value = value;
    }, dob);
  }

  await field.dispatchEvent("input");
  await field.dispatchEvent("change");

  return {
    filled: true,
    selector
  };
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

  await page.keyboard.press("Escape");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  const button = page.locator(selector).first();
  await button.scrollIntoViewIfNeeded();
  await button.click({ force: true });

  await Promise.race([
    page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {}),
    page.waitForTimeout(5000)
  ]);

  await page.waitForTimeout(3000);

  return selector;
}

async function extractTableText(page) {
  const tableTexts = await page.locator("table").evaluateAll((tables) => {
    return tables.map((table) => table.innerText || "").filter(Boolean);
  });

  return tableTexts.join("\n\n");
}

export async function fetchOptionsWithBrowser({ url }) {
  let browser = null;

  const startedAt = Date.now();

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
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
    page.setDefaultTimeout(60000);

    await setupFastPage(page);
    await gotoResultPage(page, url);

    const finalUrl = page.url();

    const selects = await page.locator("select").evaluateAll((items) => {
      return items.map((select, index) => ({
        index,
        id: select.id || "",
        name: select.name || "",
        label:
          select.closest("tr")?.innerText?.split("\n")?.[0]?.trim() ||
          select.parentElement?.innerText?.split("\n")?.[0]?.trim() ||
          "",
        options: Array.from(select.options)
          .map((option) => ({
            value: option.value,
            label: option.textContent.trim()
          }))
          .filter((option) => option.value || option.label)
      }));
    });

    const bodyText = await page.locator("body").innerText().catch(() => "");

    await browser.close();

    return {
      success: true,
      url,
      finalUrl,
      selects,
      textPreview: bodyText.slice(0, 1000),
      durationMs: Date.now() - startedAt
    };
  } catch (err) {
    if (browser) await browser.close().catch(() => {});

    return {
      success: false,
      url,
      error: err.message || "Failed to fetch options",
      durationMs: Date.now() - startedAt
    };
  }
}

async function fillForm(page, { rollNo, yearPart, resultType, dob }) {
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

  const resultTypeSelection = await selectResultTypeIfAvailable(
    page,
    resultType || "MAIN"
  );

  const filledRollFields = await fillRollFields(page, rollNo);
  const filledDob = await fillDobField(page, dob);

  return {
    yearSelectSelector,
    selected,
    resultTypeSelection,
    filledRollFields,
    filledDob
  };
}

// Reads the page as it is right now and classifies it. `dialogs` collects
// alert() messages (e.g. "Invalid Captcha"); each is only counted once.
async function snapshotPage(page, rollNo, dialogs) {
  const bodyText = stripText(await page.locator("body").innerText());
  const tableText = stripText(await extractTableText(page));
  const dialogText = stripText(dialogs.splice(0).join(" "));

  const combinedText = stripText(
    [bodyText, tableText, dialogText].filter(Boolean).join("\n\n")
  );

  const captchaPresent = await hasCaptchaChallenge(page);

  return {
    combinedText,
    captchaPresent,
    status: detectResultStatus({ text: combinedText, rollNo, captchaPresent })
  };
}

// "browser" mode: a person types the CAPTCHA and clicks Show Result in the
// visible window. We just watch until a result (or not-found) appears.
async function waitForManualResult(page, { rollNo, dialogs, timeoutMs }) {
  await page.bringToFront().catch(() => {});

  const captchaSelector = await findFirstVisible(page, CAPTCHA_INPUT_SELECTORS);

  if (captchaSelector) {
    await page.locator(captchaSelector).first().focus().catch(() => {});
  }

  console.log(
    `[resultFetcher] ${rollNo}: type the CAPTCHA in the browser window and click Show Result (waiting up to ${Math.round(
      timeoutMs / 1000
    )}s)`
  );

  const deadline = Date.now() + timeoutMs;
  let last = null;

  while (Date.now() < deadline) {
    await page.waitForTimeout(1500);

    try {
      last = await snapshotPage(page, rollNo, dialogs);

      const state = last.status.status;

      // Done when a result / not-found shows up, or the CAPTCHA box is gone.
      if (
        state === "result_found" ||
        state === "not_found" ||
        !last.captchaPresent
      ) {
        return last;
      }
    } catch {
      // page is mid-navigation, look again on the next tick
    }
  }

  return {
    combinedText: last ? last.combinedText : "",
    captchaPresent: true,
    status: {
      status: "captcha_required",
      resultFound: false,
      reason: "timed out waiting for manual CAPTCHA entry"
    }
  };
}

export async function fetchResultWithBrowser({
  rollNo,
  yearPart,
  resultType = "MAIN",
  formUrl,
  dob,
  captchaMode = process.env.CAPTCHA_MODE || "skip",
  getCaptchaText = promptCaptchaFromTerminal,
  maxCaptchaAttempts = 3,
  manualTimeoutMs = 180000
}) {
  let browser = null;

  const startedAt = Date.now();
  const mode = ["skip", "prompt", "browser"].includes(captchaMode)
    ? captchaMode
    : "skip";

  try {
    browser = await chromium.launch({
      headless: mode !== "browser",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
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

    page.setDefaultTimeout(60000);

    const dialogs = [];

    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      dialog.accept().catch(() => {});
    });

    await setupFastPage(page, { allowImages: mode !== "skip" });

    const maxAttempts =
      mode === "prompt" ? Math.max(1, Number(maxCaptchaAttempts) || 1) : 1;

    let beforeUrl = "";
    let form = null;
    let clickedSelector = "";
    let snapshot = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;

      // Every attempt starts from a fresh page, which also means a fresh CAPTCHA.
      await gotoResultPage(page, formUrl);

      if (attempt === 1) beforeUrl = page.url();

      const captchaOnPage = await hasCaptchaChallenge(page);

      if (captchaOnPage && mode === "skip") {
        // Nothing is submitted, so there is nothing for the queue to retry.
        snapshot = {
          combinedText: stripText(
            await page.locator("body").innerText().catch(() => "")
          ),
          captchaPresent: true,
          status: {
            status: "captcha_required",
            resultFound: false,
            reason: "captcha_required"
          }
        };
        break;
      }

      form = await fillForm(page, { rollNo, yearPart, resultType, dob });

      if (captchaOnPage && mode === "prompt") {
        const image = await readCaptchaImage(page);

        let typed = "";
        let promptError = "";

        try {
          typed = await getCaptchaText({
            rollNo,
            yearPart,
            attempt,
            imageBuffer: image.buffer,
            imageBase64: image.buffer.toString("base64"),
            fullPage: image.fullPage
          });
        } catch (err) {
          promptError = err.message || "CAPTCHA prompt failed";
        }

        if (!String(typed || "").trim()) {
          snapshot = {
            combinedText: "",
            captchaPresent: true,
            status: {
              status: "captcha_required",
              resultFound: false,
              reason: promptError || "no CAPTCHA text provided"
            }
          };
          break;
        }

        form.captchaSelector = await fillCaptchaField(page, typed);
        clickedSelector = await clickSubmit(page);
        snapshot = await snapshotPage(page, rollNo, dialogs);
      } else if (captchaOnPage && mode === "browser") {
        snapshot = await waitForManualResult(page, {
          rollNo,
          dialogs,
          timeoutMs: manualTimeoutMs
        });
      } else {
        // No CAPTCHA on the page (the site may drop it): submit as before.
        clickedSelector = await clickSubmit(page);
        snapshot = await snapshotPage(page, rollNo, dialogs);
      }

      const state = snapshot.status.status;
      const rejected = state === "captcha_failed" || state === "captcha_required";

      if (!(mode === "prompt" && rejected && attempt < maxAttempts)) break;
    }

    const afterUrl = page.url();
    const { combinedText, status } = snapshot;

    const needsHuman =
      status.status === "captcha_required" ||
      status.status === "captcha_failed";

    const usefulLines = needsHuman ? [] : extractUsefulLines(combinedText);

    const marksSummary = usefulLines.length
      ? usefulLines.join("\n")
      : needsHuman
      ? ""
      : combinedText.slice(0, 3500);

    const screenshotBase64 =
      process.env.INCLUDE_SCREENSHOT === "true"
        ? await page
            .screenshot({
              fullPage: true,
              type: "png"
            })
            .then((buffer) => buffer.toString("base64"))
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
      // true => a person has to enter a CAPTCHA; automatic retries can't fix it.
      needsHuman,
      captcha: {
        mode,
        attempts
      },
      selected: {
        beforeUrl,
        afterUrl,
        dropdownSelector: form ? form.yearSelectSelector : "",
        selectedValue: form ? form.selected.selectedValue : "",
        selectedLabel: form ? form.selected.selectedLabel : "",
        resultTypeSelection: form ? form.resultTypeSelection : null,
        filledRollFields: form ? form.filledRollFields : [],
        filledDob: form ? form.filledDob : null,
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

    let message = err.message || "Browser worker failed";

    if (mode === "browser" && /X server|DISPLAY|headed/i.test(message)) {
      message =
        "captchaMode 'browser' needs a machine with a display. On a server use 'prompt' with your own getCaptchaText. (" +
        message +
        ")";
    }

    return {
      success: false,
      error: message,
      rollNo,
      yearPart,
      resultType,
      formUrl,
      durationMs: Date.now() - startedAt
    };
  }
}

// ---------------------------------------------------------------------------
// Human-in-the-loop CAPTCHA sessions (used by the admin CAPTCHA page)
//
// start  -> opens the form, fills it in, keeps the page open, returns the
//           CAPTCHA image.
// submit -> a person typed the CAPTCHA; type it into the SAME page (the image
//           is tied to that page's session), submit, read the result. If the
//           site rejects it, reload for a fresh CAPTCHA and return that image.
// Sessions live in memory and close themselves after a few idle minutes.
// ---------------------------------------------------------------------------

const captchaSessions = new Map();
const CAPTCHA_SESSION_TTL_MS = 4 * 60 * 1000;
const MAX_CAPTCHA_SESSIONS = 2;

const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu"
];

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function closeCaptchaSession(sessionId) {
  const session = captchaSessions.get(sessionId);

  if (!session) return { closed: false };

  captchaSessions.delete(sessionId);
  clearTimeout(session.timer);
  await session.browser.close().catch(() => {});

  return { closed: true };
}

function touchCaptchaSession(session) {
  clearTimeout(session.timer);

  session.timer = setTimeout(() => {
    closeCaptchaSession(session.id);
  }, CAPTCHA_SESSION_TTL_MS);
}

// Loads a fresh copy of the form (=> a fresh CAPTCHA), fills it, and returns
// the CAPTCHA image, or null if the page is not asking for one.
async function prepareCaptchaForm(session) {
  const { page, params } = session;

  await gotoResultPage(page, params.formUrl);

  if (!session.beforeUrl) session.beforeUrl = page.url();

  session.form = await fillForm(page, params);

  if (!(await hasCaptchaChallenge(page))) return null;

  const image = await readCaptchaImage(page);

  return {
    imageBase64: image.buffer.toString("base64"),
    fullPage: image.fullPage,
    // Debug: what the worker actually filled in on the university form.
    formInfo: {
      year: session.form?.selected?.selectedLabel || "",
      resultType: session.form?.resultTypeSelection?.selected ?? null,
      rollFields: (session.form?.filledRollFields || []).length,
      dob: session.form?.filledDob || null
    }
  };
}

function buildSessionResult(session, snapshot, clickedSelector) {
  const { params, form } = session;
  const { combinedText, status } = snapshot;

  const needsHuman =
    status.status === "captcha_required" || status.status === "captcha_failed";

  const usefulLines = needsHuman ? [] : extractUsefulLines(combinedText);

  const marksSummary = usefulLines.length
    ? usefulLines.join("\n")
    : needsHuman
    ? ""
    : combinedText.slice(0, 3500);

  return {
    success: true,
    rollNo: params.rollNo,
    yearPart: params.yearPart,
    resultType: params.resultType,
    formUrl: params.formUrl,
    resultFound: status.resultFound,
    resultStatus: status.status,
    reason: status.reason,
    needsHuman,
    captcha: {
      mode: "session",
      attempts: session.attempts
    },
    selected: {
      beforeUrl: session.beforeUrl,
      afterUrl: session.page.url(),
      dropdownSelector: form ? form.yearSelectSelector : "",
      selectedValue: form ? form.selected.selectedValue : "",
      selectedLabel: form ? form.selected.selectedLabel : "",
      resultTypeSelection: form ? form.resultTypeSelection : null,
      filledRollFields: form ? form.filledRollFields : [],
      filledDob: form ? form.filledDob : null,
      clickedSelector
    },
    marksSummary,
    textPreview: combinedText.slice(0, 3500),
    screenshotBase64: null,
    durationMs: Date.now() - session.startedAt
  };
}

export async function startCaptchaSession({
  rollNo,
  yearPart,
  resultType = "MAIN",
  formUrl,
  dob
}) {
  while (captchaSessions.size >= MAX_CAPTCHA_SESSIONS) {
    await closeCaptchaSession(captchaSessions.keys().next().value);
  }

  const browser = await chromium.launch({
    headless: true,
    args: BROWSER_ARGS
  });

  const session = {
    id: randomUUID(),
    browser,
    page: null,
    dialogs: [],
    params: { rollNo, yearPart, resultType, formUrl, dob },
    form: null,
    beforeUrl: "",
    attempts: 1,
    startedAt: Date.now(),
    timer: null
  };

  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: DESKTOP_USER_AGENT
    });

    session.page = await context.newPage();
    session.page.setDefaultTimeout(60000);

    session.page.on("dialog", (dialog) => {
      session.dialogs.push(dialog.message());
      dialog.accept().catch(() => {});
    });

    await setupFastPage(session.page, { allowImages: true });

    captchaSessions.set(session.id, session);
    touchCaptchaSession(session);

    const shown = await prepareCaptchaForm(session);

    if (shown) {
      return {
        state: "awaiting_captcha",
        sessionId: session.id,
        ...shown
      };
    }

    // The page did not ask for a CAPTCHA: submit straight away.
    const clickedSelector = await clickSubmit(session.page);
    const snapshot = await snapshotPage(
      session.page,
      rollNo,
      session.dialogs
    );
    const result = buildSessionResult(session, snapshot, clickedSelector);

    await closeCaptchaSession(session.id);

    return { state: "done", result };
  } catch (err) {
    await closeCaptchaSession(session.id);
    await browser.close().catch(() => {});
    throw err;
  }
}

export async function submitCaptchaSession({ sessionId, text }) {
  const session = captchaSessions.get(sessionId);

  if (!session) return { state: "expired" };

  const typed = String(text || "").trim();

  if (!typed) {
    return { state: "error", error: "CAPTCHA text is empty" };
  }

  touchCaptchaSession(session);

  try {
    await fillCaptchaField(session.page, typed);

    const clickedSelector = await clickSubmit(session.page);

    const snapshot = await snapshotPage(
      session.page,
      session.params.rollNo,
      session.dialogs
    );

    const state = snapshot.status.status;

    if (state === "captcha_failed" || state === "captcha_required") {
      // Rejected: load the form again for a new CAPTCHA, same session.
      session.attempts += 1;

      // Debug: what the site showed right after submit (form + any alert()).
      const text = String(snapshot.combinedText || "");
      const pageText =
        text.length > 700
          ? `${text.slice(0, 350)} ... ${text.slice(-350)}`
          : text;

      const shown = await prepareCaptchaForm(session);

      if (shown) {
        return {
          state: "captcha_rejected",
          sessionId,
          reason: snapshot.status.reason,
          pageText,
          ...shown
        };
      }
    }

    const result = buildSessionResult(session, snapshot, clickedSelector);

    await closeCaptchaSession(sessionId);

    return { state: "done", result };
  } catch (err) {
    await closeCaptchaSession(sessionId);
    throw err;
  }
}
