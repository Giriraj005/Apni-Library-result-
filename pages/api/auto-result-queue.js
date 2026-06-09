import { requireCron, safeJsonError } from "../../lib/security";
import { createQueueForBatch } from "../../lib/resultQueue";
import { logEvent } from "../../lib/logger";
import { RESULT_FORM_CANDIDATES } from "../../lib/resultCourseCatalog";
import { validateResultLink } from "../../lib/resultLinkValidator";

async function getActiveFormUrls() {
  const results = [];

  for (const form of RESULT_FORM_CANDIDATES) {
    try {
      const validation = await validateResultLink(form.url);

      results.push({
        ...form,
        valid: Boolean(validation.valid),
        status: validation.status || null,
        reason: validation.reason || "",
        safeUrl: validation.safeUrl || ""
      });
    } catch (err) {
      results.push({
        ...form,
        valid: false,
        status: null,
        reason: err.message || "validation_failed",
        safeUrl: ""
      });
    }
  }

  return {
    forms: results,
    activeFormUrls: results
      .filter((item) => item.valid)
      .map((item) => item.url)
  };
}

export default async function handler(req, res) {
  try {
    requireCron(req);

    const resultType = req.query.resultType || "MAIN";
    const force = String(req.query.force || "") === "1";

    const active = await getActiveFormUrls();

    if (!force && !active.activeFormUrls.length) {
      await logEvent("auto_queue", "info", "No active result forms found", {
        resultType,
        forms: active.forms
      });

      return res.status(200).json({
        success: true,
        mode: "auto_result_queue",
        resultType,
        created: 0,
        activeFormUrls: [],
        forms: active.forms,
        reason: "no_active_result_forms"
      });
    }

    const result = await createQueueForBatch({
      resultType,
      formUrls: force ? [] : active.activeFormUrls
    });

    await logEvent("auto_queue", "info", "Auto result queue created", {
      resultType,
      force,
      activeFormUrls: active.activeFormUrls,
      created: result.created
    });

    return res.status(200).json({
      success: true,
      mode: "auto_result_queue",
      resultType,
      force,
      activeFormUrls: active.activeFormUrls,
      forms: active.forms,
      ...result
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
