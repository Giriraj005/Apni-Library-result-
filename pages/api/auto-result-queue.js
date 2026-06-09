import { requireCron, safeJsonError } from "../../lib/security";
import { createQueueForBatch } from "../../lib/resultQueue";
import { logEvent } from "../../lib/logger";

export default async function handler(req, res) {
  try {
    requireCron(req);

    const resultType = req.query.resultType || "MAIN";

    const result = await createQueueForBatch({
      resultType
    });

    await logEvent("auto_queue", "info", "Auto result queue created", {
      resultType,
      created: result.created
    });

    return res.status(200).json({
      success: true,
      mode: "auto_result_queue",
      resultType,
      ...result
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
