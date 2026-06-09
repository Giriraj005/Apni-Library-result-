import {
  FALLBACK_RESULT_OPTIONS,
  RESULT_FORM_CANDIDATES,
  getGroupIdForOption,
  normalizeCourseKey
} from "../../lib/resultCourseCatalog";

function getWorkerConfig() {
  const url = process.env.WORKER_URL;
  const secret = process.env.WORKER_SECRET;

  return {
    workerUrl: url ? url.replace(/\/+$/, "") : "",
    workerSecret: secret || ""
  };
}

async function fetchWithTimeout(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal
    });

    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchWorkerOptions(form) {
  const { workerUrl, workerSecret } = getWorkerConfig();

  if (!workerUrl || !workerSecret) {
    return {
      success: false,
      error: "Worker not configured",
      form
    };
  }

  const url = `${workerUrl}/fetch-options?secret=${encodeURIComponent(
    workerSecret
  )}&url=${encodeURIComponent(form.url)}`;

  try {
    const response = await fetchWithTimeout(url, 9000);
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success) {
      return {
        success: false,
        error: data?.error || `Worker failed: ${response.status}`,
        form
      };
    }

    return {
      success: true,
      form,
      data
    };
  } catch (err) {
    return {
      success: false,
      error: err.name === "AbortError" ? "Worker options timeout" : err.message,
      form
    };
  }
}

function looksLikeYearPartOption(text = "") {
  const v = String(text || "").toUpperCase();

  if (!v || v === "SELECT" || v === "SELECT YEAR PART") return false;

  return (
    v.includes("SEMESTER") ||
    v.includes("PART") ||
    v.includes("FINAL") ||
    v.includes("PREVIOUS") ||
    v.includes("B.A") ||
    v.includes("B.SC") ||
    v.includes("B.COM") ||
    v.includes("M.A") ||
    v.includes("M.SC") ||
    v.includes("M.COM") ||
    v.includes("B.ED") ||
    v.includes("M.ED") ||
    v.includes("B.P.ED") ||
    v.includes("L.L.M") ||
    v.includes("M.B.A") ||
    v.includes("M.C.A")
  );
}

function selectLooksLikeYearPart(select) {
  const hay = `${select.id || ""} ${select.name || ""} ${
    select.label || ""
  }`.toUpperCase();

  if (hay.includes("RESULT TYPE")) return false;

  const optionText = (select.options || [])
    .map((o) => `${o.label} ${o.value}`)
    .join(" ")
    .toUpperCase();

  return (
    hay.includes("DDL_RESULT") ||
    hay.includes("YEAR") ||
    hay.includes("PART") ||
    optionText.includes("SEMESTER") ||
    optionText.includes("PART") ||
    optionText.includes("FINAL") ||
    optionText.includes("PREVIOUS")
  );
}

function extractOptionsFromFetch(fetchResult) {
  if (!fetchResult.success) return [];

  const form = fetchResult.form;
  const selects = fetchResult.data?.selects || [];

  const yearSelects = selects.filter(selectLooksLikeYearPart);
  const options = [];

  for (const select of yearSelects) {
    for (const option of select.options || []) {
      const label = option.label || option.value;

      if (!looksLikeYearPartOption(label)) continue;

      options.push({
        label,
        value: option.value || label,
        yearPart: label,
        formKey: form.key,
        formLabel: form.label,
        formUrl: form.url,
        selectId: select.id || "",
        selectName: select.name || "",
        source: "worker"
      });
    }
  }

  return options;
}

function dedupeOptions(options) {
  const map = new Map();

  for (const option of options) {
    const key = normalizeCourseKey(`${option.label}_${option.formUrl}`);

    if (!map.has(key)) {
      map.set(key, option);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    String(a.label).localeCompare(String(b.label))
  );
}

function mergeFallbackOptions(workerOptions) {
  const merged = [...workerOptions];

  for (const fallback of FALLBACK_RESULT_OPTIONS) {
    const exists = merged.some(
      (option) =>
        normalizeCourseKey(option.label) === normalizeCourseKey(fallback.label) &&
        String(option.formUrl || "") === String(fallback.formUrl || "")
    );

    if (!exists) {
      merged.push(fallback);
    }
  }

  return dedupeOptions(merged);
}

function buildGroups(options) {
  const baseGroups = [
    {
      id: "all",
      label: "All Live Result Options",
      subtitle: "Worker + fallback exact dropdown options",
      options: []
    },
    {
      id: "pg_nep",
      label: "PG / Semester / NEP",
      subtitle: "PG NEP, PG semester, MBA, MCA, LLM and linked semester results",
      options: []
    },
    {
      id: "ug_nep",
      label: "UG NEP Semester",
      subtitle: "BA, BSc, BCom, BBA, BCA semester results",
      options: []
    },
    {
      id: "pg_annual",
      label: "PG Annual / Final / Previous",
      subtitle: "MA, MSc, MCom final/previous annual results",
      options: []
    },
    {
      id: "ug_annual",
      label: "UG Annual / Old Scheme",
      subtitle: "BA, BSc, BCom, BBA, BCA Part results",
      options: []
    },
    {
      id: "bed_med",
      label: "B.Ed / M.Ed / Integrated",
      subtitle: "B.Ed, BA B.Ed, BSc B.Ed, M.Ed and related results",
      options: []
    },
    {
      id: "credit_other",
      label: "Credit / Other Results",
      subtitle: "Credit based semester and other result forms",
      options: []
    },
    {
      id: "other",
      label: "Other",
      subtitle: "Extra options found on official result forms",
      options: []
    }
  ];

  const groupMap = new Map(baseGroups.map((g) => [g.id, g]));

  for (const option of options) {
    groupMap.get("all").options.push(option);

    const groupId = getGroupIdForOption(option);
    const group = groupMap.get(groupId) || groupMap.get("other");
    group.options.push(option);
  }

  return baseGroups.filter((group) => group.options.length || group.id === "all");
}

export default async function handler(req, res) {
  try {
    const fetches = await Promise.allSettled(
      RESULT_FORM_CANDIDATES.map((form) => fetchWorkerOptions(form))
    );

    const workerResults = fetches.map((item, index) => {
      if (item.status === "fulfilled") return item.value;

      return {
        success: false,
        error: item.reason?.message || "Unknown worker fetch error",
        form: RESULT_FORM_CANDIDATES[index]
      };
    });

    const workerOptions = workerResults.flatMap(extractOptionsFromFetch);
    const options = mergeFallbackOptions(workerOptions);
    const groups = buildGroups(options);

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");

    return res.status(200).json({
      success: true,
      source: workerOptions.length ? "worker+fallback" : "fallback",
      totalOptions: options.length,
      formsChecked: RESULT_FORM_CANDIDATES.length,
      workerResults: workerResults.map((item) => ({
        success: item.success,
        formKey: item.form?.key,
        formUrl: item.form?.url,
        error: item.error || "",
        selects: item.data?.selects?.length || 0
      })),
      groups,
      options
    });
  } catch (err) {
    const options = dedupeOptions(FALLBACK_RESULT_OPTIONS);
    const groups = buildGroups(options);

    return res.status(200).json({
      success: true,
      source: "fallback",
      totalOptions: options.length,
      formsChecked: RESULT_FORM_CANDIDATES.length,
      workerResults: [],
      groups,
      options,
      fallbackReason: err.message || "Failed to load live result options"
    });
  }
      }
