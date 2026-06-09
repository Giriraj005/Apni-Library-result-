import { requireAdmin, safeJsonError, normalizeRollNo } from "../../lib/security";
import {
  resolveYearPart,
  getFormUrlForYearPart,
  resultTypeLabel
} from "../../lib/resultCourseCatalog";
import {
  detectResultStatus,
  submitAspNetResultForm
} from "../../lib/resultParser";

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const input = req.method === "POST" ? req.body || {} : req.query || {};

    const rollNo = normalizeRollNo(input.rollNo);
    const course = input.course || "";
    const semester = input.semester || "";
    const yearPart = resolveYearPart({
      course,
      semester,
      yearPart: input.yearPart || input.courseOption || ""
    });

    const resultType = resultTypeLabel(input.resultType || "MAIN");
    const formUrl = input.formUrl || getFormUrlForYearPart(yearPart);

    if (!rollNo || !yearPart) {
      return res.status(400).json({
        success: false,
        error: "rollNo and yearPart/course are required"
      });
    }

    const out = await submitAspNetResultForm({
      formUrl,
      yearPart,
      resultType,
      rollNo
    });

    const status = detectResultStatus(out.html, rollNo);

    return res.status(200).json({
      success: true,
      rollNo,
      yearPart,
      resultType,
      formUrl,
      selected: out.selected,
      resultStatus: status.status,
      resultFound: status.resultFound,
      reason: status.reason,
      marksSummary: status.marksSummary || status.textPreview || "",
      textPreview: status.textPreview || ""
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
