import { cleanText } from "./security";

export function stripHtml(html) {
  return cleanText(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/td>/gi, " | ")
      .replace(/<\/th>/gi, " | ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
  );
}

function decodeHtml(value) {
  return cleanText(
    String(value || "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/<[^>]*>/g, " ")
  );
}

function normalizeForMatch(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "");
}

function getAttr(tag, attr) {
  const re = new RegExp(`\\b${attr}=["']([^"']*)["']`, "i");
  return tag.match(re)?.[1] || "";
}

export function parseOptions(html) {
  const selectRegex = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  const optionRegex =
    /<option\b([^>]*)value=["']?([^"'>]*)["']?[^>]*>([\s\S]*?)<\/option>/gi;

  const selects = [];
  let sm;

  while ((sm = selectRegex.exec(html))) {
    const selectAttrs = sm[1] || "";
    const selectHtml = sm[2] || "";

    const name = getAttr(selectAttrs, "name");
    const id = getAttr(selectAttrs, "id");

    const options = [];
    let om;

    while ((om = optionRegex.exec(selectHtml))) {
      const optionAttrs = om[1] || "";
      const value = cleanText(om[2]);
      const label = cleanText(om[3].replace(/<[^>]*>/g, " "));
      const selected = /selected/i.test(optionAttrs);

      if (value || label) {
        options.push({
          value,
          label,
          selected
        });
      }
    }

    selects.push({
      name,
      id,
      options
    });
  }

  return selects;
}

export function getHiddenFields(html) {
  const fields = {};
  const regex = /<input\b[^>]*type=["']hidden["'][^>]*>/gi;

  let match;
  while ((match = regex.exec(html))) {
    const tag = match[0];
    const name = getAttr(tag, "name");
    const value = getAttr(tag, "value");

    if (name) fields[name] = value || "";
  }

  return fields;
}

function getAllInputs(html) {
  const inputs = [];
  const regex = /<input\b[^>]*>/gi;

  let match;
  while ((match = regex.exec(html))) {
    const tag = match[0];

    inputs.push({
      tag,
      type: getAttr(tag, "type").toLowerCase(),
      name: getAttr(tag, "name"),
      id: getAttr(tag, "id"),
      value: getAttr(tag, "value"),
      placeholder: getAttr(tag, "placeholder")
    });
  }

  return inputs;
}

function getFormAction(html, fallbackUrl) {
  const formMatch = String(html || "").match(/<form\b([^>]*)>/i);

  if (!formMatch) return fallbackUrl;

  const attrs = formMatch[1] || "";
  const action = getAttr(attrs, "action");

  if (!action) return fallbackUrl;

  try {
    return new URL(action, fallbackUrl).toString();
  } catch {
    return fallbackUrl;
  }
}

function findSelect(selects, keywords) {
  const byName = selects.find((s) => {
    const hay = `${s.name} ${s.id}`.toLowerCase();
    return keywords.some((k) => hay.includes(k));
  });

  if (byName) return byName;

  return selects.find((s) =>
    s.options.some((o) =>
      /semester|main|reval|b\.a|b\.sc|b\.com|m\.a|m\.sc|m\.com|m\.b\.a|m\.c\.a|l\.l\.m/i.test(
        `${o.label} ${o.value}`
      )
    )
  );
}

function findOptionValue(select, label) {
  if (!select) return "";

  const target = normalizeForMatch(label);

  const exact = select.options.find((o) => {
    return (
      normalizeForMatch(o.label) === target ||
      normalizeForMatch(o.value) === target
    );
  });

  if (exact) return exact.value || exact.label;

  const loose = select.options.find((o) => {
    const hay = normalizeForMatch(`${o.label} ${o.value}`);
    return hay.includes(target) || target.includes(hay);
  });

  return loose ? loose.value || loose.label : "";
}

function guessRollFieldName(html) {
  const inputs = getAllInputs(html);

  const roll = inputs.find((input) => {
    const hay = `${input.name} ${input.id} ${input.placeholder}`.toLowerCase();
    return hay.includes("roll");
  });

  if (roll?.name) return roll.name;

  const textInput = inputs.find((input) => {
    return (
      (!input.type || input.type === "text" || input.type === "number") &&
      input.name
    );
  });

  return textInput?.name || "txtRollNo";
}

function guessSubmitControl(html) {
  const inputs = getAllInputs(html);

  const candidates = inputs.filter((input) => {
    return ["submit", "button", "image"].includes(input.type);
  });

  const best = candidates.find((input) => {
    const hay = `${input.name} ${input.id} ${input.value}`.toLowerCase();
    return (
      hay.includes("result") ||
      hay.includes("show") ||
      hay.includes("submit") ||
      hay.includes("search") ||
      hay.includes("view") ||
      hay.includes("check")
    );
  });

  if (best?.name) {
    return {
      name: best.name,
      value: best.value || "Show Result"
    };
  }

  const first = candidates.find((input) => input.name);

  if (first?.name) {
    return {
      name: first.name,
      value: first.value || "Submit"
    };
  }

  return {
    name: "",
    value: ""
  };
}

function detectDoPostBackTarget(html) {
  const match = String(html || "").match(/__doPostBack\('([^']+)'/i);

  if (match?.[1]) {
    return match[1];
  }

  return "";
}

export function detectCaptcha(textOrHtml) {
  const text = stripHtml(textOrHtml).toLowerCase();

  return (
    text.includes("captcha") ||
    text.includes("verification code") ||
    text.includes("security code")
  );
}

export function parseHtmlTables(html) {
  const tables = [];
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
  const cellRegex = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;

  let tm;
  while ((tm = tableRegex.exec(html))) {
    const tableHtml = tm[0];
    const rows = [];
    let rm;

    while ((rm = rowRegex.exec(tableHtml))) {
      const rowHtml = rm[0];
      const cells = [];
      let cm;

      while ((cm = cellRegex.exec(rowHtml))) {
        cells.push(decodeHtml(cm[2]));
      }

      if (cells.length) rows.push(cells);
    }

    if (rows.length) tables.push(rows);
  }

  return tables;
}

export function extractMarksSummary(html) {
  const text = stripHtml(html);
  const tables = parseHtmlTables(html);

  const importantRows = [];

  for (const table of tables) {
    for (const row of table) {
      const rowText = row.join(" | ");
      const r = rowText.toLowerCase();

      if (
        r.includes("subject") ||
        r.includes("paper") ||
        r.includes("marks") ||
        r.includes("max") ||
        r.includes("min") ||
        r.includes("obt") ||
        r.includes("total") ||
        r.includes("result") ||
        r.includes("sgpa") ||
        r.includes("cgpa") ||
        r.includes("pass") ||
        r.includes("fail") ||
        r.includes("promoted")
      ) {
        importantRows.push(rowText);
      }
    }
  }

  const basicLines = text
    .split(/\n|\|/)
    .map((x) => cleanText(x))
    .filter(Boolean)
    .filter((line) => {
      const l = line.toLowerCase();
      return (
        l.includes("student") ||
        l.includes("name") ||
        l.includes("father") ||
        l.includes("mother") ||
        l.includes("roll") ||
        l.includes("enrol") ||
        l.includes("subject") ||
        l.includes("paper") ||
        l.includes("marks") ||
        l.includes("total") ||
        l.includes("result") ||
        l.includes("sgpa") ||
        l.includes("cgpa") ||
        l.includes("pass") ||
        l.includes("fail") ||
        l.includes("promoted")
      );
    })
    .slice(0, 100);

  const summary = [...new Set([...basicLines, ...importantRows])];

  if (!summary.length && text.toLowerCase().includes("result")) {
    return text.slice(0, 2500);
  }

  return summary.slice(0, 100).join("\n");
}

export function detectResultStatus(html, rollNo = "") {
  const text = stripHtml(html);
  const lower = text.toLowerCase();

  const looksLikeBlankForm =
    lower.includes("select year part") &&
    lower.includes("txtrollno") === false &&
    lower.includes("student name") === false &&
    lower.includes("marks") === false &&
    lower.includes("father") === false;

  if (detectCaptcha(html)) {
    return {
      status: "captcha_detected",
      resultFound: false,
      reason: "CAPTCHA/manual verification detected",
      textPreview: text.slice(0, 1200)
    };
  }

  const notFoundWords = [
    "record not found",
    "not found",
    "result not declared",
    "invalid roll",
    "no record",
    "please select",
    "enter roll",
    "wrong roll"
  ];

  for (const word of notFoundWords) {
    if (lower.includes(word)) {
      return {
        status: "not_found",
        resultFound: false,
        reason: word,
        textPreview: text.slice(0, 1200)
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
    "cgpa",
    "obtained"
  ];

  let hits = 0;

  for (const word of strongWords) {
    if (lower.includes(word)) hits += 1;
  }

  if (rollNo && lower.includes(String(rollNo).toLowerCase())) hits += 2;

  const marksSummary = extractMarksSummary(html);

  if (hits >= 4 && text.length > 250) {
    return {
      status: "result_found",
      resultFound: true,
      reason: `strong keywords matched: ${hits}`,
      textPreview: marksSummary || text.slice(0, 1800),
      marksSummary,
      fullText: text
    };
  }

  if (looksLikeBlankForm) {
    return {
      status: "form_returned",
      resultFound: false,
      reason:
        "Result form returned again. Submit button/postback was probably not accepted by server.",
      textPreview: text.slice(0, 1200)
    };
  }

  return {
    status: "unknown",
    resultFound: false,
    reason: "No clear result/not-found signature",
    textPreview: text.slice(0, 1200)
  };
}

export async function submitAspNetResultForm({
  formUrl,
  yearPart,
  resultType,
  rollNo
}) {
  const initial = await fetch(formUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 ApniLibraryResultAlert/1.0",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  const initialHtml = await initial.text();
  const actionUrl = getFormAction(initialHtml, formUrl);
  const hidden = getHiddenFields(initialHtml);
  const selects = parseOptions(initialHtml);

  const yearSelect = findSelect(selects, [
    "year",
    "part",
    "class",
    "course",
    "semester"
  ]);

  const typeSelect = findSelect(selects, ["type", "result"]);

  const yearValue = findOptionValue(yearSelect, yearPart);
  const typeValue = findOptionValue(typeSelect, resultType || "MAIN");

  if (!yearValue) {
    const available = yearSelect?.options?.map((o) => o.label || o.value) || [];

    throw new Error(
      `Dropdown option not found: ${yearPart}. Available: ${available.join(
        ", "
      )}`
    );
  }

  const form = new URLSearchParams();

  for (const [k, v] of Object.entries(hidden)) {
    form.set(k, v);
  }

  if (yearSelect?.name) form.set(yearSelect.name, yearValue);
  if (typeSelect?.name && typeValue) form.set(typeSelect.name, typeValue);

  const rollFieldName = guessRollFieldName(initialHtml);
  form.set(rollFieldName, rollNo);

  const submitControl = guessSubmitControl(initialHtml);

  if (submitControl.name) {
    form.set(submitControl.name, submitControl.value || "Show Result");
  } else {
    const eventTarget = detectDoPostBackTarget(initialHtml);
    if (eventTarget) {
      form.set("__EVENTTARGET", eventTarget);
      form.set("__EVENTARGUMENT", "");
    }
  }

  const res = await fetch(actionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 ApniLibraryResultAlert/1.0",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Origin: new URL(formUrl).origin,
      Referer: formUrl
    },
    body: form.toString()
  });

  const html = await res.text();

  return {
    ok: res.ok,
    statusCode: res.status,
    html,
    text: stripHtml(html),
    selects,
    selected: {
      formUrl,
      actionUrl,
      yearPart,
      yearSelectName: yearSelect?.name || "",
      yearValue,
      resultType,
      typeSelectName: typeSelect?.name || "",
      typeValue,
      rollNo,
      rollFieldName,
      submitName: submitControl.name,
      submitValue: submitControl.value
    }
  };
                    }
