import { db } from "../../lib/firebaseAdmin";
import { requireAdmin, safeJsonError } from "../../lib/security";
import {
  detectResultStatus,
  submitAspNetResultForm
} from "../../lib/resultParser";
import { logEvent } from "../../lib/logger";

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const sourceSnap = await db.collection("result_sources").doc("pdusu_main").get();
    const source = sourceSnap.exists ? sourceSnap.data() : {};

    const formUrl = req.body?.resultFormUrl || source.activeNepResultUrl;
    const yearPart = req.body?.yearPart;
    const resultType = req.body?.resultType || "MAIN";
    const rollNo = req.body?.rollNo;

    if (!formUrl || !yearPart || !rollNo) {
      return res.status(400).json({
        success: false,
        error: "formUrl/yearPart/rollNo required"
      });
    }

    const out = await submitAspNetResultForm({
      formUrl,
      yearPart,
      resultType,
      rollNo
    });

    const status = detectResultStatus(out.html, rollNo);

    await logEvent("admin_test", "info", "Manual result test completed", {
      formUrl,
      yearPart,
      resultType,
      rollNo,
      status: status.status
    });

    return res.status(200).json({
      success: true,
      formUrl,
      selected: out.selected,
      resultStatus: status,
      textPreview: out.text.slice(0, 3000),
      selectCount: out.selects?.length || 0
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
