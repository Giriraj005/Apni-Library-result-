import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireAdmin, safeJsonError } from "../../lib/security";
import { parseOptions } from "../../lib/resultParser";
import { logEvent } from "../../lib/logger";

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const sourceSnap = await db.collection("result_sources").doc("pdusu_main").get();
    const source = sourceSnap.exists ? sourceSnap.data() : {};
    const url = req.body?.resultFormUrl || source.activeNepResultUrl;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "No active NEP result form URL found"
      });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 ApniLibraryResultAlert/1.0"
      }
    });

    const html = await response.text();
    const selects = parseOptions(html);

    await db.collection("result_form_options").doc("active_nep_form").set(
      {
        formUrl: url,
        selects,
        updatedAt: FieldValue.serverTimestamp()
      },
      {
        merge: true
      }
    );

    await logEvent("form_options", "info", "Result form options synced", {
      url,
      selectCount: selects.length
    });

    return res.status(200).json({
      success: true,
      formUrl: url,
      selects
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
