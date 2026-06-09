export const OFFICIAL_MAIN_PORTAL = "https://shekhauniexam.in/";

export const RESULT26_BASE_URL = "https://result26.shekhauniexam.in/";

export const RESULT26_FORMS = {
  UG_NEP: `${RESULT26_BASE_URL}NEP_RESULT.aspx`,
  PG_NEP: `${RESULT26_BASE_URL}PG_NEP_RESULT.aspx`,
  RESULT_LIST: `${RESULT26_BASE_URL}RESULTS.aspx`
};

export const PG_SEMESTER_I_OPTIONS = [
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
  "M.B.A SEMESTER I"
];

export const PG_SEMESTER_III_OPTIONS = [
  "M.A JMC SEMESTER III"
];

export const UG_NEOP_OPTIONS = [
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
];

export const OTHER_RESULT_OPTIONS = [
  "B.ED SEMESTER-I",
  "B.ED SEMESTER-II",
  "B.ED SEMESTER-III",
  "B.ED SEMESTER-IV",
  "M.ED SEMESTER I",
  "M.ED SEMESTER II",
  "M.ED SEMESTER IV",
  "B.P.ED SEMESTER I",
  "B.P.ED SEMESTER II",
  "B.P.ED SEMESTER III",
  "B.P.ED SEMESTER IV"
];

export const COURSE_CATALOG = [
  ...PG_SEMESTER_I_OPTIONS,
  ...PG_SEMESTER_III_OPTIONS,
  ...UG_NEOP_OPTIONS,
  ...OTHER_RESULT_OPTIONS
];

export function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

  if (v.includes("SEMESTER I") && !v.includes("II") && !v.includes("III") && !v.includes("IV") && !v.includes("VI")) return "I";
  if (v.includes("SEMESTER II") && !v.includes("III")) return "II";
  if (v.includes("SEMESTER III")) return "III";
  if (v.includes("SEMESTER IV")) return "IV";
  if (v.includes("SEMESTER V") && !v.includes("VI")) return "V";
  if (v.includes("SEMESTER VI")) return "VI";

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

  if (direct) {
    const exact = COURSE_CATALOG.find(
      (item) => normalizeCourseKey(item) === normalizeCourseKey(direct)
    );
    if (exact) return exact;

    if (
      direct.includes("SEMESTER") &&
      !direct.includes("PG NEP") &&
      !direct.includes("UG NEP")
    ) {
      return direct;
    }
  }

  const wantedCourse = normalizeCourseKey(course);
  const wantedSem = normalizeSemester(semester);

  const exactByCourseSem = COURSE_CATALOG.find((option) => {
    const optionCourse = normalizeCourseKey(optionCourseOnly(option));
    const optionSem = optionSemester(option);
    return optionCourse === wantedCourse && optionSem === wantedSem;
  });

  if (exactByCourseSem) return exactByCourseSem;

  const loose = COURSE_CATALOG.find((option) => {
    const key = normalizeCourseKey(option);
    return key.includes(wantedCourse) && optionSemester(option) === wantedSem;
  });

  if (loose) return loose;

  if (wantedCourse && wantedSem) {
    return `${cleanText(course).toUpperCase()} SEMESTER ${wantedSem}`;
  }

  return direct || cleanText(course).toUpperCase();
}

export function getResultFormType(yearPart = "") {
  const y = cleanText(yearPart).toUpperCase();

  if (
    y.startsWith("M.") ||
    y.startsWith("MA ") ||
    y.startsWith("M.A") ||
    y.startsWith("M.SC") ||
    y.startsWith("M.COM") ||
    y.startsWith("M.C.A") ||
    y.startsWith("M.B.A") ||
    y.startsWith("L.L.M") ||
    y.startsWith("LL.M")
  ) {
    return "PG_NEP";
  }

  return "UG_NEP";
}

export function getFormUrlForYearPart(yearPart = "") {
  const type = getResultFormType(yearPart);
  return type === "PG_NEP" ? RESULT26_FORMS.PG_NEP : RESULT26_FORMS.UG_NEP;
}

export function getCatalogForFormType(type) {
  if (type === "PG_NEP") return [...PG_SEMESTER_I_OPTIONS, ...PG_SEMESTER_III_OPTIONS];
  if (type === "UG_NEP") return UG_NEOP_OPTIONS;
  return COURSE_CATALOG;
}

export function resultTypeLabel(value = "MAIN") {
  const v = cleanText(value).toUpperCase();

  if (v.includes("REVAL")) return "REVAL";
  if (v.includes("SUPP")) return "SUPPLEMENTARY";
  if (v.includes("SPECIAL")) return "SPECIAL";
  return "MAIN";
       }
