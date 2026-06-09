import { db, FieldValue } from "./firebaseAdmin";
import { normalizeKey } from "./security";
import { logEvent } from "./logger";
import {
  resolveYearPart,
  getFormUrlForYearPart,
  resultTypeLabel
} from "./resultCourseCatalog";

export function makeRegistrationKey({ rollNo, course, semester, resultType }) {
  return normalizeKey(`${rollNo}_${course}_${semester}_${resultType || "MAIN"}`);
}

export function makeResultEventKey({
  rollNo,
  yearPart,
  resultType,
  targetYear
}) {
  return normalizeKey(
    `${rollNo}_${yearPart}_${resultType || "MAIN"}_${
      targetYear || process.env.TARGET_RESULT_YEAR || "2025-26"
    }`
  );
}

function shouldIncludeRegistration(reg, { courses, semesters, yearParts, formUrls }) {
  const yearPart = resolveYearPart({
    course: reg.course,
    semester: reg.semester,
    yearPart: reg.yearPart
  });

  if (yearParts?.length) {
    const allowed = yearParts.map((x) => normalizeKey(x));
    if (!allowed.includes(normalizeKey(yearPart))) return false;
  }

  if (formUrls?.length) {
    const allowed = formUrls.map((x) => String(x).trim());
    if (!allowed.includes(String(reg.formUrl || "").trim())) return false;
  }

  if (courses?.length) {
    const allowed = courses.map((x) => normalizeKey(x));
    if (!allowed.includes(normalizeKey(reg.course))) return false;
  }

  if (semesters?.length) {
    const allowed = semesters.map((x) => normalizeKey(x));
    if (!allowed.includes(normalizeKey(reg.semester))) return false;
  }

  return true;
}

export async function createQueueForBatch({
  courses = [],
  semesters = [],
  yearParts = [],
  formUrls = [],
  resultType = "MAIN"
}) {
  const normalizedResultType = resultTypeLabel(resultType);

  const registrationsSnap = await db
    .collection("result_registrations")
    .where("resultType", "==", normalizedResultType)
    .where("status", "in", [
      "waiting",
      "portal_found",
      "result_detected",
      "not_found",
      "failed_retrying",
      "in_queue"
    ])
    .limit(500)
    .get();

  let created = 0;
  const batch = db.batch();

  registrationsSnap.docs.forEach((doc) => {
    const reg = doc.data();

    if (!shouldIncludeRegistration(reg, { courses, semesters, yearParts, formUrls })) {
      return;
    }

    const exactYearPart = resolveYearPart({
      course: reg.course,
      semester: reg.semester,
      yearPart: reg.yearPart
    });

    const formUrl = reg.formUrl || getFormUrlForYearPart(exactYearPart);

    const queueId = makeResultEventKey({
      rollNo: reg.rollNo,
      yearPart: exactYearPart,
      resultType: normalizedResultType,
      targetYear: process.env.TARGET_RESULT_YEAR
    });

    const ref = db.collection("result_queue").doc(queueId);

    batch.set(
      ref,
      {
        registrationId: doc.id,
        rollNo: reg.rollNo,
        yearPart: exactYearPart,
        course: reg.course,
        semester: reg.semester,
        resultType: normalizedResultType,
        formUrl,
        status: "pending",
        attempts: 0,
        resultFound: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      {
        merge: true
      }
    );

    batch.update(doc.ref, {
      yearPart: exactYearPart,
      formUrl,
      status: "in_queue",
      updatedAt: FieldValue.serverTimestamp()
    });

    created += 1;
  });

  if (created) await batch.commit();

  await logEvent("queue", "info", `Created/updated ${created} queue items`, {
    created
  });

  return {
    created
  };
}
