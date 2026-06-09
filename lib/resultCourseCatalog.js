export const OFFICIAL_MAIN_PORTAL = "https://shekhauniexam.in/";

export const RESULT26_BASE_URL = "https://result26.shekhauniexam.in/";

export const RESULT26_FORMS = {
  PG_NEP: `${RESULT26_BASE_URL}PG_NEP_RESULT.aspx`,
  UG_NEP: `${RESULT26_BASE_URL}NEP_RESULT.aspx`,
  PG_ANNUAL: `${RESULT26_BASE_URL}PG_Result.aspx`,
  UG_ANNUAL: `${RESULT26_BASE_URL}UGResult.aspx`,
  UGBED: `${RESULT26_BASE_URL}ugbedresult.aspx`,
  MA_CREDIT: `${RESULT26_BASE_URL}MASemesterResult_credit.aspx`,
  RESULT_LIST: `${RESULT26_BASE_URL}RESULTS.aspx`
};

export const RESULT_FORM_CANDIDATES = [
  {
    key: "PG_NEP",
    label: "PG NEP / Semester Results",
    url: RESULT26_FORMS.PG_NEP
  },
  {
    key: "UG_NEP",
    label: "UG NEP Semester Results",
    url: RESULT26_FORMS.UG_NEP
  },
  {
    key: "PG_ANNUAL",
    label: "PG Annual / Previous / Final Results",
    url: RESULT26_FORMS.PG_ANNUAL
  },
  {
    key: "UG_ANNUAL",
    label: "UG Annual / Old Scheme Results",
    url: RESULT26_FORMS.UG_ANNUAL
  },
  {
    key: "UGBED",
    label: "B.Ed / BA B.Ed / BSc B.Ed / M.Ed Results",
    url: RESULT26_FORMS.UGBED
  },
  {
    key: "MA_CREDIT",
    label: "Semester Credit / Other Results",
    url: RESULT26_FORMS.MA_CREDIT
  }
];

export const FALLBACK_RESULT_OPTIONS = [
  {
    label: "M.COM ABST SEMESTER I",
    value: "M.COM ABST SEMESTER I",
    formKey: "PG_NEP",
    formUrl: RESULT26_FORMS.PG_NEP
  },
  {
    label: "M.COM BADM SEMESTER I",
    value: "M.COM BADM SEMESTER I",
    formKey: "PG_NEP",
    formUrl: RESULT26_FORMS.PG_NEP
  },
  {
    label: "M.COM EAFM SEMESTER I",
    value: "M.COM EAFM SEMESTER I",
    formKey: "PG_NEP",
    formUrl: RESULT26_FORMS.PG_NEP
  },
  {
    label: "M.A HISTORY SEMESTER I",
    value: "M.A HISTORY SEMESTER I",
    formKey: "PG_NEP",
    formUrl: RESULT26_FORMS.PG_NEP
  },
  {
    label: "M.A HINDI SEMESTER I",
    value: "M.A HINDI SEMESTER I",
    formKey: "PG_NEP",
    formUrl: RESULT26_FORMS.PG_NEP
  },
  {
    label: "M.SC. CHEMISTRY SEMESTER I",
    value: "M.SC. CHEMISTRY SEMESTER I",
    formKey: "PG_NEP",
    formUrl: RESULT26_FORMS.PG_NEP
  },
  {
    label: "B.ED SEMESTER-II",
    value: "B.ED SEMESTER-II",
    formKey: "PG_NEP",
    formUrl: RESULT26_FORMS.PG_NEP
  },
  {
    label: "B.A SEMESTER I",
    value: "B.A SEMESTER I",
    formKey: "UG_NEP",
    formUrl: RESULT26_FORMS.UG_NEP
  },
  {
    label: "B.SC SEMESTER I",
    value: "B.SC SEMESTER I",
    formKey: "UG_NEP",
    formUrl: RESULT26_FORMS.UG_NEP
  },
  {
    label: "B.COM SEMESTER I",
    value: "B.COM SEMESTER I",
    formKey: "UG_NEP",
    formUrl: RESULT26_FORMS.UG_NEP
  },
  {
    label: "B.A PART-III",
    value: "B.A PART-III",
    formKey: "UG_ANNUAL",
    formUrl: RESULT26_FORMS.UG_ANNUAL
  },
  {
    label: "B.COM PART-III",
    value: "B.COM PART-III",
    formKey: "UG_ANNUAL",
    formUrl: RESULT26_FORMS.UG_ANNUAL
  },
  {
    label: "M.A. (FINAL) HISTORY",
    value: "M.A. (FINAL) HISTORY",
    formKey: "PG_ANNUAL",
    formUrl: RESULT26_FORMS.PG_ANNUAL
  }
];

export function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCourseKey(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}

export function normalizeSemester(value) {
  const v = cleanText(value).toUpperCase();

  if (["1", "I", "SEM I", "SEMESTER I", "FIRST", "1ST"].includes(v)) return "I";
  if (["2", "II", "SEM II", "SEMESTER II", "SECOND", "2ND"].includes(v)) return "II";
  if (["3", "III", "SEM III", "SEMESTER III", "THIRD", "3RD"].includes(v)) return "III";
  if (["4", "IV", "SEM IV", "SEMESTER IV", "FOURTH", "4TH"].includes(v)) return "IV";
  if (["5", "V", "SEM V", "SEMESTER V", "FIFTH", "5TH"].includes(v)) return "V";
  if (["6", "VI", "SEM VI", "SEMESTER VI", "SIXTH", "6TH"].includes(v)) return "VI";

  return v;
}

export function optionSemester(option) {
  const value = cleanText(option).toUpperCase();

  if (value.includes("SEMESTER-I") || value.includes("SEMESTER I")) return "I";
  if (value.includes("SEMESTER-II") || value.includes("SEMESTER II")) return "II";
  if (value.includes("SEMESTER-III") || value.includes("SEMESTER III")) return "III";
  if (value.includes("SEMESTER-IV") || value.includes("SEMESTER IV")) return "IV";
  if (value.includes("SEMESTER-VI") || value.includes("SEMESTER VI")) return "VI";
  if (value.includes("SEMESTER-V") || value.includes("SEMESTER V")) return "V";

  return "";
}

export function optionCourseOnly(option) {
  return cleanText(option)
    .toUpperCase()
    .replace(/SEMESTER[- ]?I\b/g, "")
    .replace(/SEMESTER[- ]?II\b/g, "")
    .replace(/SEMESTER[- ]?III\b/g, "")
    .replace(/SEMESTER[- ]?IV\b/g, "")
    .replace(/SEMESTER[- ]?V\b/g, "")
    .replace(/SEMESTER[- ]?VI\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveYearPart({ course, semester, yearPart }) {
  const direct = cleanText(yearPart).toUpperCase();

  if (direct) return direct;

  const wantedCourse = normalizeCourseKey(course);
  const wantedSem = normalizeSemester(semester);

  const exact = FALLBACK_RESULT_OPTIONS.find((option) => {
    const optionCourse = normalizeCourseKey(optionCourseOnly(option.label));
    const optionSem = optionSemester(option.label);
    return optionCourse === wantedCourse && optionSem === wantedSem;
  });

  if (exact) return exact.label;

  if (course && semester) {
    return `${cleanText(course).toUpperCase()} SEMESTER ${wantedSem}`;
  }

  return cleanText(course).toUpperCase();
}

export function guessFormKeyFromYearPart(yearPart = "") {
  const y = cleanText(yearPart).toUpperCase();

  if (
    y.includes("PART") &&
    (y.startsWith("B.A") ||
      y.startsWith("B.SC") ||
      y.startsWith("B.COM") ||
      y.startsWith("B.B.A") ||
      y.startsWith("B.C.A"))
  ) {
    return "UG_ANNUAL";
  }

  if (y.includes("FINAL") || y.includes("PREVIOUS")) {
    return "PG_ANNUAL";
  }

  if (
    y.includes("B.ED") ||
    y.includes("M.ED") ||
    y.includes("B.A B.ED") ||
    y.includes("B.SC B.ED")
  ) {
    return "UGBED";
  }

  if (
    y.startsWith("M.") ||
    y.startsWith("MA ") ||
    y.startsWith("M.A") ||
    y.startsWith("M.SC") ||
    y.startsWith("M.COM") ||
    y.startsWith("M.C.A") ||
    y.startsWith("M.B.A") ||
    y.startsWith("L.L.M")
  ) {
    return "PG_NEP";
  }

  return "UG_NEP";
}

export function getFormUrlForYearPart(yearPart = "", explicitFormUrl = "") {
  if (explicitFormUrl) return explicitFormUrl;

  const existing = FALLBACK_RESULT_OPTIONS.find(
    (option) => normalizeCourseKey(option.label) === normalizeCourseKey(yearPart)
  );

  if (existing?.formUrl) return existing.formUrl;

  const key = guessFormKeyFromYearPart(yearPart);
  return RESULT26_FORMS[key] || RESULT26_FORMS.UG_NEP;
}

export function resultTypeLabel(value = "MAIN") {
  const v = cleanText(value).toUpperCase();

  if (v.includes("REVAL")) return "REVAL";
  if (v.includes("SUPP")) return "SUPPLEMENTARY";
  if (v.includes("SPECIAL")) return "SPECIAL";
  return "MAIN";
}

export function getGroupIdForOption(option) {
  const label = cleanText(option?.label || option?.value || "").toUpperCase();
  const formKey = option?.formKey || "";

  if (formKey === "PG_NEP") return "pg_nep";
  if (formKey === "UG_NEP") return "ug_nep";
  if (formKey === "PG_ANNUAL") return "pg_annual";
  if (formKey === "UG_ANNUAL") return "ug_annual";
  if (formKey === "UGBED") return "bed_med";
  if (formKey === "MA_CREDIT") return "credit_other";

  if (label.includes("PART")) return "annual";
  if (label.includes("B.ED") || label.includes("M.ED")) return "bed_med";
  if (label.startsWith("M.")) return "pg_nep";
  if (label.startsWith("B.")) return "ug_nep";

  return "other";
}
