import { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireAdmin, safeJsonError } from "../../lib/security";
import { logEvent } from "../../lib/logger";

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const { action, payload } = req.body || {};

    if (action === "set_active_portal") {
      const base = payload?.baseUrl;

      if (!base) {
        return res.status(400).json({
          success: false,
          error: "baseUrl required"
        });
      }

      const root = base.endsWith("/") ? base : `${base}/`;

      await db.collection("result_sources").doc("pdusu_main").set(
        {
          activeResultBaseUrl: root,
          activeResultsPageUrl: new URL("RESULTS.aspx", root).toString(),
          activeNepResultUrl: new URL("NEP_RESULT.aspx", root).toString(),
          status: "portal_found",
          manualSet: true,
          updatedAt: FieldValue.serverTimestamp()
        },
        {
          merge: true
        }
      );

      await logEvent("admin_action", "info", "Active portal manually set", {
        root
      });

      return res.status(200).json({
        success: true
      });
    }

    if (action === "add_probe_roll") {
      const { rollNo, yearPart, resultType } = payload || {};

      if (!rollNo || !yearPart) {
        return res.status(400).json({
          success: false,
          error: "rollNo and yearPart required"
        });
      }

      const id = `${String(yearPart).replace(/[^a-z0-9]/gi, "_")}_${String(
        rollNo
      ).replace(/[^a-z0-9]/gi, "_")}`.toUpperCase();

      await db.collection("result_probe_rolls").doc(id).set(
        {
          rollNo,
          yearPart,
          resultType: resultType || "MAIN",
          active: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        },
        {
          merge: true
        }
      );

      await logEvent("admin_action", "info", "Probe roll added", {
        rollNo,
        yearPart
      });

      return res.status(200).json({
        success: true,
        id
      });
    }

    if (action === "pause_automatic_checking") {
      await db.collection("result_sources").doc("pdusu_main").set(
        {
          automaticCheckingPaused: true,
          updatedAt: FieldValue.serverTimestamp()
        },
        {
          merge: true
        }
      );

      return res.status(200).json({
        success: true
      });
    }

    if (action === "resume_automatic_checking") {
      await db.collection("result_sources").doc("pdusu_main").set(
        {
          automaticCheckingPaused: false,
          updatedAt: FieldValue.serverTimestamp()
        },
        {
          merge: true
        }
      );

      return res.status(200).json({
        success: true
      });
    }

    return res.status(400).json({
      success: false,
      error: "Unknown action"
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
