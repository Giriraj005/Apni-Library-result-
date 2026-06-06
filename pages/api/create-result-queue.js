import { requireAdmin, safeJsonError } from "../../lib/security";
import { createQueueForBatch } from "../../lib/resultQueue";

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const courses = req.body?.courses || ["B.A.", "B.SC", "B.COM", "B.B.A.", "B.C.A."];
    const semesters = req.body?.semesters || ["I", "III", "V"];
    const resultType = req.body?.resultType || "MAIN";

    const result = await createQueueForBatch({
      courses,
      semesters,
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
