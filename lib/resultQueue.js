import { db, FieldValue } from "./firebaseAdmin";
import { normalizeKey } from "./security";
import { logEvent } from "./logger";

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

export async function createQueueForBatch({
  courses = [],
  semesters = [],
  resultType = "MAIN"
}) {
  const registrationsSnap = await db
    .collection("result_registrations")
    .where("resultType", "==", resultType)
    .where("status", "in", [
      "waiting",
      "portal_found",
      "result_detected",
      "not_found",
      "failed_retrying"
    ])
    .limit(500)
    .get();

  let created = 0;
  const batch = db.batch();

  registrationsSnap.docs.forEach((doc) => {
    const reg = doc.data();

    if (courses.length && !courses.includes(reg.course)) return;
    if (semesters.length && !semesters.includes(reg.semester)) return;

    const queueId = makeResultEventKey({
      rollNo: reg.rollNo,
      yearPart: reg.yearPart,
      resultType: reg.resultType,
      targetYear: process.env.TARGET_RESULT_YEAR
    });

    const ref = db.collection("result_queue").doc(queueId);

    batch.set(
      ref,
      {
        registrationId: doc.id,
        rollNo: reg.rollNo,
        yearPart: reg.yearPart,
        course: reg.course,
        semester: reg.semester,
        resultType: reg.resultType,
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
      status: "in_queue",
      updatedAt: FieldValue.serverTimestamp()
    });

    created += 1;
  });

  if (created) {
    await batch.commit();
  }

  await logEvent("queue", "info", `Created/updated ${created} queue items`, {
    created
  });

  return {
    created
  };
}
