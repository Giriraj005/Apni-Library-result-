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

function makeOption(label, formKey, formUrl) {
  return {
    label,
    value: label,
    yearPart: label,
    formKey,
    formUrl,
    source: "fallback"
  };
}

export const UG_NEP_FALLBACK_OPTIONS = [
  "B.A SEMESTER I",
  "B.A SEMESTER II",
  "B.A SEMESTER III",
  "B.A SEMESTER IV",
  "B.A SEMESTER V",
  "B.A SEMESTER VI",

  "B.SC SEMESTER I",
  "B.SC SEMESTER II",
  "B.SC SEMESTER III",
  "B.SC SEMESTER IV",
  "B.SC SEMESTER V",
  "B.SC SEMESTER VI",

  "B.COM SEMESTER I",
  "B.COM SEMESTER II",
  "B.COM SEMESTER III",
  "B.COM SEMESTER IV",
  "B.COM SEMESTER V",
  "B.COM SEMESTER VI",

  "B.B.A SEMESTER I",
  "B.B.A SEMESTER II",
  "B.B.A SEMESTER III",
  "B.B.A SEMESTER IV",
  "B.B.A SEMESTER V",
  "B.B.A SEMESTER VI",

  "B.C.A SEMESTER I",
  "B.C.A SEMESTER II",
  "B.C.A SEMESTER III",
  "B.C.A SEMESTER IV",
  "B.C.A SEMESTER V",
  "B.C.A SEMESTER VI"
].map((label) => makeOption(label, "UG_NEP", RESULT26_FORMS.UG_NEP));

export const PG_NEP_FALLBACK_OPTIONS = [
  "M.A DRAWING AND PAINTING SEMESTER I",
  "M.A ECONOMICS SEMESTER I",
  "M.A ENGLISH SEMESTER I",
  "M.A HINDI SEMESTER I",
  "M.A HISTORY SEMESTER I",
  "M.A JMC SEMESTER I",
  "M.A PHILOSOPHY SEMESTER I",
  "M.A POLITICAL SCIENCE SEMESTER I",
  "M.A PUBLIC ADMINISTRATION SEMESTER I",
  "M.A SANSKRIT SEMESTER I",
  "M.A SOCIOLOGY SEMESTER I",
  "M.A URDU SEMESTER I",
  "M.A/M.SC GEOGRAPHY SEMESTER I",
  "M.A/M.SC MATHEMATICS SEMESTER I",
  "M.A/M.SC PSYCHOLOGY SEMESTER I",
  "M.A/M.SC YOGA SEMESTER I",
  "M.COM ABST SEMESTER I",
  "M.COM BADM SEMESTER I",
  "M.COM EAFM SEMESTER I",
  "M.SC. BOTANY SEMESTER I",
  "M.SC. CHEMISTRY SEMESTER I",
  "M.SC. PHYSICS SEMESTER I",
  "M.SC. ZOOLOGY SEMESTER I",
  "MA HOME SCIENCE SEMESTER I",
  "M.SC. FORENSIC SCIENCE SEMESTER I",
  "L.L.M SEMESTER-I",
  "M.C.A. SEMESTER I",
  "M.B.A SEMESTER I",

  "L.L.M SEMESTER III",
  "M.A DRAWING AND PAINTING SEMESTER III",
  "M.A ECONOMICS SEMESTER III",
  "M.A ENGLISH SEMESTER III",
  "M.A HINDI SEMESTER III",
  "M.A HISTORY SEMESTER III",
  "M.A JMC SEMESTER III",
  "M.A PHILOSOPHY SEMESTER III",
  "M.A POLITICAL SCIENCE SEMESTER III",
  "M.A PUBLIC ADMINISTRATION SEMESTER III",
  "M.A SANSKRIT SEMESTER III",
  "M.A SOCIOLOGY SEMESTER III",
  "M.A URDU SEMESTER III",
  "M.A/M.SC GEOGRAPHY SEMESTER III",
  "M.A/M.SC MATHEMATICS SEMESTER III",
  "M.A/M.SC PSYCHOLOGY SEMESTER III",
  "M.A/M.SC YOGA SEMESTER III",
  "M.B.A SEMESTER III",
  "M.C.A. SEMESTER III",
  "M.COM ABST SEMESTER III",
  "M.COM BADM SEMESTER III",
  "M.COM EAFM SEMESTER III",
  "M.SC. BOTANY SEMESTER III",
  "M.SC. CHEMISTRY SEMESTER III",
  "M.SC. PHYSICS SEMESTER III",
  "M.SC. ZOOLOGY SEMESTER III",
  "MA HOME SCIENCE SEMESTER III",

  "B.ED SEMESTER-I",
  "B.ED SEMESTER-II",
  "B.A. B.ED. SEMESTER-I",
  "B.A. B.ED. SEMESTER-II",
  "B.SC. B.ED. SEMESTER-I",
  "B.SC. B.ED. SEMESTER-II",
  "M.ED. SEMESTER I",
  "M.ED. SEMESTER II",
  "B.Ed. Med IIND SEMESTER"
].map((label) => makeOption(label, "PG_NEP", RESULT26_FORMS.PG_NEP));

export const PG_ANNUAL_FALLBACK_OPTIONS = [
  "M.A. (PREVIOUS) DRAWING & PAINTING",
  "M.A. (PREVIOUS) ECONOMICS",
  "M.A. (PREVIOUS) ENGLISH",
  "M.A. (PREVIOUS) HINDI",
  "M.A. (PREVIOUS) HISTORY",
  "M.A. (PREVIOUS) PHILOSOPHY",
  "M.A. (PREVIOUS) POLITICAL SCIENCE",
  "M.A. (PREVIOUS) PUBLIC ADMINISTRATION",
  "M.A. (PREVIOUS) SANSKRIT",
  "M.A. (PREVIOUS) SOCIOLOGY",
  "M.A. (PREVIOUS) URDU",
  "M.A./M.SC. (PREVIOUS) GEOGRAPHY",
  "M.A./M.SC. (PREVIOUS) MATHEMATICS",
  "M.A./M.SC. (PREVIOUS) PSYCHOLOGY",
  "M.A./M.SC. (PREVIOUS) YOGA",

  "M.A. (FINAL) ECONOMICS",
  "M.A. (FINAL) POLITICAL SCIENCE",
  "M.A. (FINAL) SOCIOLOGY",
  "M.A. (FINAL) HISTORY",
  "M.A. (FINAL) DRAWING & PAINTING",
  "M.A./M.SC. (FINAL) PSYCHOLOGY",
  "M.A./M.SC. (FINAL) GEOGRAPHY",
  "M.A. (FINAL) HINDI",
  "M.A. (FINAL) PHILOSOPHY",
  "M.A./M.SC. (FINAL) MATHEMATICS",
  "M.A. (FINAL) ENGLISH",
  "M.A. (FINAL) URDU",
  "M.A. (FINAL) SANSKRIT",
  "M.A. (FINAL) PUBLIC ADMINISTRATION",
  "M.A. (FINAL) HOME SCIENCE",
  "M.COM. (FINAL) ACCOUNTANCY & BUSINESS STATISTICS",
  "M.COM. (FINAL) EAFM",
  "M.COM. (FINAL) BUSINESS ADMINISTRATION",
  "M.SC. (FINAL) ZOOLOGY",
  "M.SC. (FINAL) CHEMISTRY",
  "M.SC. (FINAL) PHYSICS",
  "M.SC. (FINAL) BOTANY"
].map((label) => makeOption(label, "PG_ANNUAL", RESULT26_FORMS.PG_ANNUAL));

export const UG_ANNUAL_FALLBACK_OPTIONS = [
  "B.A PART-II",
  "B.A PART-III",
  "B.SC PART-II",
  "B.SC PART-III",
  "B.COM PART-II",
  "B.COM PART-III",
  "B.B.A PART-II",
  "B.B.A PART-III",
  "B.C.A PART-II",
  "B.C.A PART-III"
].map((label) => makeOption(label, "UG_ANNUAL", RESULT26_FORMS.UG_ANNUAL));

export const OTHER_FALLBACK_OPTIONS = [
  "B.A. B.ED. PART-II",
  "B.A. B.ED. PART-III",
  "B.A. B.ED. PART-IV",
  "B.SC. B.ED. PART-II",
  "B.SC. B.ED. PART-III",
  "B.SC. B.ED. PART-IV",
  "B.ED PART-II",

  "B.P.ED SEM I",
  "B.P.ED SEM II",
  "B.P.ED SEM III",
  "B.P.ED SEM IV",

  "M.ED IST SEM",
  "M.ED SEMESTER IV",
  "M.ED II SEM (NEP)",

  "LL.M PART-II",
  "L.L.M SEMESTER-I",

  "B.ED SPL(VISUAL IMPAIRMENT)-II",
  "B.ED SPL(HEARING IMPAIRMENT)-II"
].map((label) => makeOption(label, "UGBED", RESULT26_FORMS.UGBED));

export const FALLBACK_RESULT_OPTIONS = [
  ...PG_NEP_FALLBACK_OPTIONS,
  ...UG_NEP_FALLBACK_OPTIONS,
  ...PG_ANNUAL_FALLBACK_OPTIONS,
  ...UG_ANNUAL_FALLBACK_OPTIONS,
  ...OTHER_FALLBACK_OPTIONS
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

  const existing = FALLBACK_RESULT_OPTIONS.find(
    (option) => normalizeCourseKey(option.label) === normalizeCourseKey(y)
  );

  if (existing?.formKey) return existing.formKey;

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
