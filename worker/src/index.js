import { launch } from "@cloudflare/playwright";

const DEFAULT_FORM_URL =
  "https://result26.shekhauniexam.in/PG_NEP_RESULT.aspx";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value)
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "");
}

function validFormUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (
        url.hostname === "shekhauniexam.in" ||
        url.hostname.endsWith(".shekhauniexam.in")
      )
    );
  } catch {
    return false;
  }
}

async function openResultPage(env, url) {
  const browser = await launch(env.BROWSER);

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

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

    await page.locator("select").first().waitFor({
      state: "visible",
      timeout: 45000
    });

    return { browser, page };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

async function getDropdownOptions(page, selector) {
  return page.locator(selector).evaluate((select) =>
    Array.from(select.options).map((option) => ({
      value: option.value,
      label: option.textContent.trim()
    }))
  );
}

async function selectDropdown(page, selector, wantedText) {
  const options = await getDropdownOptions(page, selector);
  const target = normalize(wantedText);

  const exact = options.find(
    (option) =>
      normalize(option.label) === target ||
      normalize(option.value) === target
  );

  const loose = exact || options.find((option) => {
    const combined = normalize(
      `${option.label} ${option.value}`
    );

    return (
      combined.includes(target) ||
      target.includes(combined)
    );
  });

  if (!loose) {
    throw new Error(
      `Dropdown option not found: ${wantedText}. Available: ` +
      options.map((option) => option.label || option.value).join(", ")
    );
  }

  await page.selectOption(selector, loose.value);
  await page.locator(selector).dispatchEvent("change");
  await page.waitForTimeout(800);

  return {
    selectedValue: loose.value,
    selectedLabel: loose.label
  };
}

async function fetchOptions(env, url) {
  let browser;

  try {
    const opened = await openResultPage(env, url);
    browser = opened.browser;
    const page = opened.page;

    const finalUrl = page.url();

    const selects = await page.locator("select").evaluateAll(
      (items) =>
        items.map((select, index) => ({
          index,
          id: select.id || "",
          name: select.name || "",
          label:
            select.closest("tr")?.innerText?.split("\n")[0]?.trim() ||
            select.parentElement?.innerText?.split("\n")[0]?.trim() ||
            "",
          options: Array.from(select.options).map((option) => ({
            value: option.value,
            label: option.textContent.trim()
          }))
        }))
    );

    const textPreview = await page
      .locator("body")
      .innerText()
      .catch(() => "");

    return {
      success: true,
      url,
      finalUrl,
      selects,
      textPreview: textPreview.slice(0, 1000)
    };
  } catch (error) {
    return {
      success: false,
      url,
      error: error.message || "Failed to fetch options"
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function selectResultType(page, resultType) {
  const selects = await page.locator("select").evaluateAll(
    (items) =>
      items.map((select, index) => ({
        index,
        id: select.id || "",
        name: select.name || "",
        options: Array.from(select.options).map((option) => ({
          value: option.value,
          label: option.textContent.trim()
        }))
      }))
  );

  const typeSelect = selects.find((select) => {
    const text = [
      select.id,
      select.name,
      ...select.options.flatMap((option) => [
        option.label,
        option.value
      ])
    ].join(" ").toLowerCase();

    return (
      text.includes("main") ||
      text.includes("reval") ||
      text.includes("supp") ||
      text.includes("result type")
    );
  });

  if (!typeSelect) {
    return {
      selected: false,
      reason: "Result type dropdown not found"
    };
  }

  const selector = typeSelect.id
    ? `#${typeSelect.id}`
    : typeSelect.name
      ? `select[name="${typeSelect.name}"]`
      : `select >> nth=${typeSelect.index}`;

  try {
    const selected = await selectDropdown(
      page,
      selector,
      resultType || "MAIN"
    );

    return {
      selected: true,
      reason: "",
      ...selected
    };
  } catch (error) {
    return {
      selected: false,
      reason: error.message || "Requested result type not available",
      available: typeSelect.options
    };
  }
}

async function fillRollNumber(page, rollNo) {
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

  for (const selector of selectors) {
    const locator = page.locator(selector);

    try {
      const count = await locator.count();

      for (let i = 0; i < count; i++) {
        const input = locator.nth(i);

        if (!(await input.isVisible())) continue;

        await input.fill(String(rollNo));
        await input.dispatchEvent("input");
        await input.dispatchEvent("change");

        return {
          selector,
          id: await input.getAttribute("id"),
          name: await input.getAttribute("name")
        };
      }
    } catch {
      // Try the next selector.
    }
  }

  throw new Error("Roll number input not found");
}

async function clickSubmit(page) {
  const selectors = [
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

  for (const selector of selectors) {
    const button = page.locator(selector).first();

    try {
      if (
        (await button.count()) &&
        (await button.isVisible())
      ) {
        await button.click();

        await Promise.race([
          page.waitForLoadState("networkidle", {
            timeout: 15000
          }).catch(() => {}),
          page.waitForTimeout(5000)
        ]);

        await page.waitForTimeout(2000);
        return selector;
      }
    } catch {
      // Try another submit selector.
    }
  }

  throw new Error("Submit button not found");
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
    .map(clean)
    .filter(Boolean);

  const useful = lines.filter((line) =>
    /student|name|father|mother|roll|enrol|subject|paper|marks|max|min|obt|total|result|sgpa|cgpa|pass|fail|promoted/i.test(line)
  );

  return [...new Set(useful)].slice(0, 120);
}

function detectResultStatus(text, rollNo) {
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

  const lower = String(text || "").toLowerCase();

  const keywords = [
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

  let hits = keywords.filter(
    (keyword) => lower.includes(keyword)
  ).length;

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
    lower.includes("examination result")
    return {
      status: "form_returned",
      resultFound: false,
      reason: "Form returned after submit"
    };
  }

  return {
    status: "unknown",
    resultFound: false,
    reason: "No clear result signature"
  };
}

async function fetchResult(env, input) {
  const rollNo = clean(input.rollNo);
  const yearPart = clean(input.yearPart);
  const resultType = climport { launch } from "@cloudflare/playwright";

const DEFAULT_FORM_URL =
  "https://result26.shekhauniexam.in/PG_NEP_RESULT.aspx";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value)
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "");
}

function validFormUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (
        url.hostname === "shekhauniexam.in" ||
        url.hostname.endsWith(".shekhauniexam.in")
      )
    );
  } catch {
    return false;
  }
}

async function openResultPage(env, url) {
  const browser = await launch(env.BROWSER);

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

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

    await page.locator("select").first().waitFor({
      state: "visible",
      timeout: 45000
    });

    return { browser, page };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

async function getDropdownOptions(page, selector) {
  return page.locator(selector).evaluate((select) =>
    Array.from(select.options).map((option) => ({
      value: option.value,
      label: option.textContent.trim()
    }))
  );
}

async function selectDropdown(page, selector, wantedText) {
  const options = await getDropdownOptions(page, selector);
  const target = normalize(wantedText);

  const exact = options.find(
    (option) =>
      normalize(option.label) === target ||
      normalize(option.value) === target
  );

  const loose = exact || options.find((option) => {
    const combined = normalize(
      `${option.label} ${option.value}`
    );

    return (
      combined.includes(target) ||
      target.includes(combined)
    );
  });

  if (!loose) {
    throw new Error(
      `Dropdown option not found: ${wantedText}. Available: ` +
      options.map((option) => option.label || option.value).join(", ")
    );
  }

  await page.selectOption(selector, loose.value);
  await page.locator(selector).dispatchEvent("change");
  await page.waitForTimeout(800);

  return {
    selectedValue: loose.value,
    selectedLabel: loose.label
  };
}

async function fetchOptions(env, url) {
  let browser;

  try {
    const opened = await openResultPage(env, url);
    browser = opened.browser;
    const page = opened.page;

    const finalUrl = page.url();

    const selects = await page.locator("select").evaluateAll(
      (items) =>
        items.map((select, index) => ({
          index,
          id: select.id || "",
          name: select.name || "",
          label:
            select.closest("tr")?.innerText?.split("\n")[0]?.trim() ||
            select.parentElement?.innerText?.split("\n")[0]?.trim() ||
            "",
          options: Array.from(select.options).map((option) => ({
            value: option.value,
            label: option.textContent.trim()
          }))
        }))
    );

    const textPreview = await page
      .locator("body")
      .innerText()
      .catch(() => "");

    return {
      success: true,
      url,
      finalUrl,
      selects,
      textPreview: textPreview.slice(0, 1000)
    };
  } catch (error) {
    return {
      success: false,
      url,
      error: error.message || "Failed to fetch options"
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function selectResultType(page, resultType) {
  const selects = await page.locator("select").evaluateAll(
    (items) =>
      items.map((select, index) => ({
        index,
        id: select.id || "",
        name: select.name || "",
        options: Array.from(select.options).map((option) => ({
          value: option.value,
          label: option.textContent.trim()
        }))
      }))
  );

  const typeSelect = selects.find((select) => {
    const text = [
      select.id,
      select.name,
      ...select.options.flatMap((option) => [
        option.label,
        option.value
      ])
    ].join(" ").toLowerCase();

    return (
      text.includes("main") ||
      text.includes("reval") ||
      text.includes("supp") ||
      text.includes("result type")
    );
  });

  if (!typeSelect) {
    return {
      selected: false,
      reason: "Result type dropdown not found"
    };
  }

  const selector = typeSelect.id
    ? `#${typeSelect.id}`
    : typeSelect.name
      ? `select[name="${typeSelect.name}"]`
      : `select >> nth=${typeSelect.index}`;

  try {
    const selected = await selectDropdown(
      page,
      selector,
      resultType || "MAIN"
    );

    return {
      selected: true,
      reason: "",
      ...selected
    };
  } catch (error) {
    return {
      selected: false,
      reason: error.message || "Requested result type not available",
      available: typeSelect.options
    };
  }
}

async function fillRollNumber(page, rollNo) {
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

  for (const selector of selectors) {
    const locator = page.locator(selector);

    try {
      const count = await locator.count();

      for (let i = 0; i < count; i++) {
        const input = locator.nth(i);

        if (!(await input.isVisible())) continue;

        await input.fill(String(rollNo));
        await input.dispatchEvent("input");
        await input.dispatchEvent("change");

        return {
          selector,
          id: await input.getAttribute("id"),
          name: await input.getAttribute("name")
        };
      }
    } catch {
      // Try the next selector.
    }
  }

  throw new Error("Roll number input not found");
}

async function clickSubmit(page) {
  const selectors = [
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

  for (const selector of selectors) {
    const button = page.locator(selector).first();

    try {
      if (
        (await button.count()) &&
        (await button.isVisible())
      ) {
        await button.click();

        await Promise.race([
          page.waitForLoadState("networkidle", {
            timeout: 15000
          }).catch(() => {}),
          page.waitForTimeout(5000)
        ]);

        await page.waitForTimeout(2000);
        return selector;
      }
    } catch {
      // Try another submit selector.
    }
  }

  throw new Error("Submit button not found");
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
    .map(clean)
    .filter(Boolean);

  const useful = lines.filter((line) =>
    /student|name|father|mother|roll|enrol|subject|paper|marks|max|min|obt|total|result|sgpa|cgpa|pass|fail|promoted/i.test(line)
  );

  return [...new Set(useful)].slice(0, 120);
}

function detectResultStatus(text, rollNo) {
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

  const lower = String(text || "").toLowerCase();

  const keywords = [
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

  let hits = keywords.filter(
    (keyword) => lower.includes(keyword)
  ).length;

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
    lower.includes("examination result")
  ) {
    return {
      status: "form_returned",
      resultFound: false,
      reason: "Form returned after submit"
    };
  }

  return {
    status: "unknown",
    resultFound: false,
    reason: "No clear result signature"
  };
}

async function fetchResult(env, input) {
  const rollNo = clean(input.rollNo);
  const yearPart = clean(input.yearPart);
  const resultType = clean(input.resultType || "MAIN");
  const formUrl = clean(input.formUrl || DEFAULT_FORM_URL);

  if (!rollNo || !yearPart) {
    return json({
      success: false,
      error: "rollNo and yearPart are required"
    }, 400);
  }

  if (!validFormUrl(formUrl)) {
    return json({
      success: false,
      error: "Invalid result portal URL"
    }, 400);
  }

  let browser;

  try {
    const opened = await openResultPage(env, formUrl);
    browser = opened.browser;
    const page = opened.page;

    const beforeUrl = page.url();

    const yearSelector = await page.locator("#DDL_RESULT").count()
      ? "#DDL_RESULT"
      : 'select[name="DDL_RESULT"]';

    const selected = await selectDropdown(
      page,
      yearSelector,
      yearPart
    );

    const resultTypeSelection = await selectResultType(
      page,
      resultType
    );

    const rollField = await fillRollNumber(page, rollNo);
    const clickedSelector = await clickSubmit(page);

    const afterUrl = page.url();

    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");

    const tableText = await page
      .locator("table")
      .evaluateAll((tables) =>
        tables.map((table) => table.innerText || "").join("\n\n")
      )
      .catch(() => "");

    const combinedText = clean(`${bodyText}\n${tableText}`);
    const status = detectResultStatus(combinedText, rollNo);
    const usefulLines = extractUsefulLines(combinedText);

    return json({
      success: true,
      rollNo,
      yearPart,
      resultType,
      formUrl,
      resultFound: status.resultFound,
      resultStatus: status.status,
      reason: status.reason,
      selected: {
        beforeUrl,
        afterUrl,
        dropdownSelector: yearSelector,
        selectedValue: selected.selectedValue,
        selectedLabel: selected.selectedLabel,
        resultTypeSelection,
        rollField,
        clickedSelector
      },
      marksSummary: usefulLines.length
        ? usefulLines.join("\n")
        : combinedText.slice(0, 3500),
      textPreview: combinedText.slice(0, 3500),
      screenshotBase64: null
    });
  } catch (error) {
    return json({
      success: false,
      error: error.message || "Browser worker failed",
      rollNo,
      yearPart,
      resultType,
      formUrl
    }, 500);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET" && path === "/") {
      return json({
        success: true,
        name: "PDUSU Result Worker",
        status: "online"
      });
    }

    if (request.method === "GET" && path === "/health") {
      return json({
        success: true,
        status: "ok",
        time: new Date().toISOString()
      });
    }

    if (
      path !== "/fetch-result" &&
      path !== "/fetch-options"
    ) {
      return json({
        success: false,
        error: "Not found"
      }, 404);
    }

    let body = {};

    if (request.method === "POST") {
      body = await request.json().catch(() => ({}));
    }

    const suppliedSecret =
      request.headers.get("x-worker-secret") ||
      url.searchParams.get("secret") ||
      body.secret;

    if (
      !env.WORKER_SECRET ||
      suppliedSecret !== env.WORKER_SECRET
    ) {
      return json({
        success: false,
        error: "Unauthorized worker request"
      }, 401);
    }

    if (
      path === "/fetch-options" &&
      request.method === "GET"
    ) {
      const targetUrl = url.searchParams.get("url") || "";

      if (!validFormUrl(targetUrl)) {
        return json({
          success: false,
          error: "A valid result portal URL is required"
        }, 400);
      }

      return json(await fetchOptions(env, targetUrl));
    }

    if (
      path === "/fetch-result" &&
      request.method === "POST"
    ) {
      return await fetchResult(env, body);
    }

    return json({
      success: false,
      error: "Method not allowed"
    }, 405);
  }
};
￼Enterean(input.resultType || "MAIN");
  const formUrl = clean(input.formUrl || DEFAULT_FORM_URL);

  if (!rollNo || !yearPart) {
    return json({
      success: false,
      error: "rollNo and yearPart are required"
    }, 400);
  }

  if (!validFormUrl(formUrl)) {
    return json({
      success: false,
      error: "Invalid result portal URL"
    }, 400);
  }

  let browser;

  try {
    const opened = await openResultPage(env, formUrl);
    browser = opened.browser;
    const page = opened.page;

    const beforeUrl = page.url();

    const yearSelector = await page.locator("#DDL_RESULT").count()
      ? "#DDL_RESULT"
      : 'select[name="DDL_RESULT"]';

    const selected = await selectDropdown(
      page,
      yearSelector,
      yearPart
    );

    const resultTypeSelection = await selectResultType(
      page,
      resultType
    );

    const rollField = await fillRollNumber(page, rollNo);
    const clickedSelector = await clickSubmit(page);

    const afterUrl = page.url();

    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");

    const tableText = await page
      .locator("table")
      .evaluateAll((tables) =>
        tables.map((table) => table.innerText || "").join("\n\n")
      )
      .catch(() => "");

    const combinedText = clean(`${bodyText}\n${tableText}`);
    const status = detectResultStatus(combinedText, rollNo);
    const usefulLines = extractUsefulLines(combinedText);

    return json({
      success: true,
      rollNo,
      yearPart,
      resultType,
      formUrl,
      resultFound: status.resultFound,
      resultStatus: status.status,
      reason: status.reason,
      selected: {
        beforeUrl,
        afterUrl,
        dropdownSelector: yearSelector,
        selectedValue: selected.selectedValue,
        selectedLabel: selected.selectedLabel,
        resultTypeSelection,
        rollField,
        clickedSelector
      },
      marksSummary: usefulLines.length
        ? usefulLines.join("\n")
