export const OFFICIAL_MAIN_PORTAL = "https://shekhauniexam.in/";

export const RESULT26_BASE_URL = "https://result26.shekhauniexam.in/";

export const RESULT26_DIRECT_LINKS = {
  officialPortal: OFFICIAL_MAIN_PORTAL,
  resultBaseUrl: RESULT26_BASE_URL,
  ugNepResultUrl: `${RESULT26_BASE_URL}NEP_RESULT.aspx`,
  pgNepResultUrl: `${RESULT26_BASE_URL}PG_NEP_RESULT.aspx`,
  resultListUrl: `${RESULT26_BASE_URL}RESULTS.aspx`
};

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

export async function validateResultLink(url) {
  const resultUrl = normalizeResultUrl(url);

  if (!resultUrl) {
    return {
      valid: false,
      safeUrl: OFFICIAL_MAIN_PORTAL,
      originalUrl: url || "",
      reason: "empty_or_invalid_url"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(resultUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 ApniLibraryResultAlert/1.0"
      }
    });

    const text = await response.text();
    clearTimeout(timeout);

    const lower = text.toLowerCase();

    const serverError =
      lower.includes("server error in '/' application") ||
      lower.includes("the resource cannot be found") ||
      lower.includes("http 404") ||
      lower.includes("runtime error") ||
      lower.includes("requested url:");

    const resultSignal =
      lower.includes("result") ||
      lower.includes("examination result") ||
      lower.includes("course name") ||
      lower.includes("check result") ||
      lower.includes("roll") ||
      lower.includes("semester");

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
      reason:
        err.name === "AbortError"
          ? "validation_timeout"
          : err.message || "validation_failed"
    };
  }
}

export async function validateDirectResultForms() {
  const forms = [
    {
      type: "UG_NEP",
      label: "UG NEP Result",
      url: RESULT26_DIRECT_LINKS.ugNepResultUrl
    },
    {
      type: "PG_NEP",
      label: "PG NEP Result",
      url: RESULT26_DIRECT_LINKS.pgNepResultUrl
    }
  ];

  const results = [];

  for (const form of forms) {
    const validation = await validateResultLink(form.url);

    results.push({
      ...form,
      ...validation
    });
  }

  return results;
}

export function buildResultInstruction(validatedLink, directLinks = {}) {
  if (validatedLink?.valid) {
    return "Students official result page पर अपना course/semester select करके roll number से result check करें।";
  }

  if (directLinks?.pgNepResultUrl || directLinks?.ugNepResultUrl) {
    return "Students official exam portal open करें। PG result के लिए PG NEP Result link और UG result के लिए UG NEP Result link use करें। अगर direct link open नहीं हो, तो main official portal पर “RESULT - 2025-26” या “Results-2025-26” पर click करें।";
  }

  return "Students official exam portal open करके “RESULT - 2025-26” या “Results-2025-26” पर click करें, फिर अपना course/semester select करके roll number से result check करें।";
}
