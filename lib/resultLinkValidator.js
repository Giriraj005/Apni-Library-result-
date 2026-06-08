export const OFFICIAL_MAIN_PORTAL = "https://shekhauniexam.in/";

export const RESULT26_BASE_URL = "https://result26.shekhauniexam.in/";

export const RESULT26_DIRECT_LINKS = {
  officialPortal: OFFICIAL_MAIN_PORTAL,
  resultBaseUrl: RESULT26_BASE_URL,
  ugNepResultUrl: `${RESULT26_BASE_URL}NEP_RESULT.aspx`,
  pgNepResultUrl: `${RESULT26_BASE_URL}PG_NEP_RESULT.aspx`,
  resultListUrl: `${RESULT26_BASE_URL}RESULTS.aspx`
};

export const RESULT26_DIRECT_FORMS = [
  {
    type: "UG_NEP",
    label: "UG NEP Result",
    alertTitle: "PDUSU UG NEP Result 2025-26",
    url: RESULT26_DIRECT_LINKS.ugNepResultUrl
  },
  {
    type: "PG_NEP",
    label: "PG NEP Result",
    alertTitle: "PDUSU PG NEP Result 2025-26",
    url: RESULT26_DIRECT_LINKS.pgNepResultUrl
  }
];

export function isSessionBasedResultLink(url = "") {
  return String(url).includes("/(S(") || String(url).includes("%28S%28");
}

export function normalizeResultUrl(url) {
  const value = String(url || "").trim();

  if (!value) return "";

  try {
    return new URL(value).toString();
  } catch {
    return "";
  }
}

export function deriveStableResultLinksFromDetectedUrl(detectedUrl = "") {
  const value = String(detectedUrl || "");

  if (value.includes("result26.shekhauniexam.in")) {
    return RESULT26_DIRECT_LINKS;
  }

  return {
    officialPortal: OFFICIAL_MAIN_PORTAL,
    resultBaseUrl: "",
    ugNepResultUrl: "",
    pgNepResultUrl: "",
    resultListUrl: ""
  };
}

function hasServerErrorPage(text = "") {
  const lower = String(text || "").toLowerCase();

  return (
    lower.includes("server error in '/' application") ||
    lower.includes("the resource cannot be found") ||
    lower.includes("http 404") ||
    lower.includes("runtime error") ||
    lower.includes("requested url:") ||
    lower.includes("404 - file or directory not found") ||
    lower.includes("resource you are looking for has been removed")
  );
}

function hasResultPageSignal(text = "") {
  const lower = String(text || "").toLowerCase();

  return (
    lower.includes("result") ||
    lower.includes("examination result") ||
    lower.includes("course name") ||
    lower.includes("check result") ||
    lower.includes("roll") ||
    lower.includes("roll no") ||
    lower.includes("roll number") ||
    lower.includes("semester") ||
    lower.includes("select class") ||
    lower.includes("class for result") ||
    lower.includes("enter roll") ||
    lower.includes("submit") ||
    lower.includes("marks")
  );
}

export async function validateResultLink(url) {
  const resultUrl = normalizeResultUrl(url);

  if (!resultUrl) {
    return {
      valid: false,
      safeUrl: OFFICIAL_MAIN_PORTAL,
      originalUrl: url || "",
      status: null,
      reason: "empty_or_invalid_url"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(resultUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 ApniLibraryResultAlert/1.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    const text = await response.text();
    clearTimeout(timeout);

    const serverError = hasServerErrorPage(text);
    const resultSignal = hasResultPageSignal(text);

    if (!response.ok || serverError || !resultSignal) {
      return {
        valid: false,
        safeUrl: OFFICIAL_MAIN_PORTAL,
        originalUrl: resultUrl,
        status: response.status,
        reason: serverError ? "server_error_or_404_page" : "no_result_signal"
      };
    }

    return {
      valid: true,
      safeUrl: resultUrl,
      originalUrl: resultUrl,
      status: response.status,
      reason: "valid_result_page"
    };
  } catch (err) {
    clearTimeout(timeout);

    return {
      valid: false,
      safeUrl: OFFICIAL_MAIN_PORTAL,
      originalUrl: resultUrl,
      status: null,
      reason:
        err.name === "AbortError"
          ? "validation_timeout"
          : err.message || "validation_failed"
    };
  }
}

export async function validateDirectResultForms() {
  const results = [];

  for (const form of RESULT26_DIRECT_FORMS) {
    const validation = await validateResultLink(form.url);

    results.push({
      ...form,
      ...validation
    });
  }

  return results;
}

export function getBestDisplayUrl({
  directFormValidations = [],
  validatedLink = null
} = {}) {
  const validForms = directFormValidations.filter((item) => item.valid);

  const ug = validForms.find((item) => item.type === "UG_NEP");
  if (ug) return ug.url;

  const pg = validForms.find((item) => item.type === "PG_NEP");
  if (pg) return pg.url;

  if (validatedLink?.valid) return validatedLink.safeUrl;

  return OFFICIAL_MAIN_PORTAL;
}

export function buildResultInstruction(validatedLink, directLinks = {}) {
  if (directLinks?.pgNepResultUrl || directLinks?.ugNepResultUrl) {
    return "Students official result page पर अपना course/semester select करके roll number से result check करें। अगर direct link open नहीं हो, तो main official portal पर “RESULT - 2025-26” या “Results-2025-26” पर click करें।";
  }

  if (validatedLink?.valid) {
    return "Students official result page पर अपना course/semester select करके roll number से result check करें।";
  }

  return "Students official exam portal open करके “RESULT - 2025-26” या “Results-2025-26” पर click करें, फिर अपना course/semester select करके roll number से result check करें।";
}
