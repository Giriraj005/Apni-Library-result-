import { requireAdmin, safeJsonError } from "../../lib/security";
import { createQueueForBatch } from "../../lib/resultQueue";

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const input = req.method === "POST" ? req.body || {} : req.query || {};

    const courses = Array.isArray(input.courses)
      ? input.courses
      : input.courses
      ? String(input.courses).split(",").map((x) => x.trim()).filter(Boolean)
      : [];

    const semesters = Array.isArray(input.semesters)
      ? input.semesters
      : input.semesters
      ? String(input.semesters).split(",").map((x) => x.trim()).filter(Boolean)
      : [];

    const yearParts = Array.isArray(input.yearParts)
      ? input.yearParts
      : input.yearParts
      ? String(input.yearParts).split("|").map((x) => x.trim()).filter(Boolean)
      : [];

    const resultType = input.resultType || "MAIN";

    const result = await createQueueForBatch({
      courses,
      semesters,
      yearParts,
      resultType
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
