import { db } from "../../lib/firebaseAdmin";
import { normalizeRollNo, safeJsonError } from "../../lib/security";

function compactSummary(text = "") {
  const raw = String(text || "").replace(/\s+/g, " ").trim();

  if (!raw) return "";

  const totalMatch = raw.match(
    /FIRST SEMESTER\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([-\d.]+|---)\s+([A-Z]+)/i
  );

  if (totalMatch) {
    return `Total Marks: ${totalMatch[2]}/${totalMatch[1]}\nSGPA: ${totalMatch[7]}\nResult: ${totalMatch[9]}`;
  }

  const sgpa = raw.match(/\bSGPA\s+([\d.]+)/i)?.[1];
  const result = raw.match(/\b(PAPR|FAPR|BKPR|PASS|FAIL|PROMOTED)\b/i)?.[1];

  const parts = [];

  if (sgpa) parts.push(`SGPA: ${sgpa}`);
  if (result) parts.push(`Result: ${result.toUpperCase()}`);

  return parts.length ? parts.join("\n") : "";
}

async function loadOutput(resultId) {
  if (!resultId) return null;

  const snap = await db.collection("result_outputs").doc(resultId).get();

  return snap.exists ? snap.data() : null;
}

export default async function handler(req, res) {
  try {
    const rollNo = normalizeRollNo(req.query.rollNo || "");

    if (!rollNo) {
      return res.status(400).json({
        success: false,
        error: "rollNo is required"
      });
    }

    const regSnap = await db
      .collection("result_registrations")
      .where("rollNo", "==", rollNo)
      .limit(20)
      .get();

    const registrations = [];

    for (const doc of regSnap.docs) {
      const reg = doc.data();
      const output = await loadOutput(reg.resultId);

      registrations.push({
        id: doc.id,
        rollNo: reg.rollNo || rollNo,
        studentName: reg.studentName || "",
        mobile: reg.mobile || "",
        yearPart: reg.yearPart || reg.course || "",
        course: reg.course || "",
        semester: reg.semester || "",
        resultType: reg.resultType || "MAIN",
        formUrl: reg.formUrl || "",
        status: reg.status || "waiting",
        resultFound: Boolean(reg.resultFound),
        resultId: reg.resultId || null,

        adminTelegramSent: Boolean(reg.adminTelegramSent),
        studentWhatsAppSent: Boolean(reg.studentWhatsAppSent),
        studentWhatsAppLastError: reg.studentWhatsAppLastError || "",

        officialUrl: output?.officialUrl || reg.formUrl || "",
        resultSummary: compactSummary(output?.marksSummary || output?.resultText || ""),
        createdAt: reg.createdAt?._seconds || null,
        updatedAt: reg.updatedAt?._seconds || null
      });
    }

    return res.status(200).json({
      success: true,
      rollNo,
      total: registrations.length,
      registrations
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
