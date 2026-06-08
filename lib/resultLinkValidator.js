export const OFFICIAL_MAIN_PORTAL = "https://shekhauniexam.in/";

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
      lower.includes("roll");

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

export function buildResultInstruction(validatedLink) {
  if (validatedLink?.valid) {
    return "Students official result page पर अपना course/semester select करके roll number से result check करें।";
  }

  return "Students official exam portal open करके “RESULT - 2025-26” या “Results-2025-26” पर click करें, फिर अपना course/semester select करके roll number से result check करें।";
}
