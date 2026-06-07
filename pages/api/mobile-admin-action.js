import { db, FieldValue } from "../../lib/firebaseAdmin";
import { safeJsonError } from "../../lib/security";

function checkAdmin(req) {
  const admin =
    req.query.admin ||
    req.headers["x-admin-secret"] ||
    req.body?.adminSecret;

  if (!process.env.ADMIN_SECRET || admin !== process.env.ADMIN_SECRET) {
    const err = new Error("Unauthorized admin request");
    err.statusCode = 401;
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    checkAdmin(req);

    const action = req.query.action;

    if (action === "set_active_portal") {
      const baseUrl = req.query.baseUrl;

      if (!baseUrl) {
        return res.status(400).json({
          success: false,
          error: "baseUrl required"
        });
      }

      const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

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

      return res.status(200).json({
        success: true,
        message: "Active portal set successfully",
        activeResultBaseUrl: root,
        activeResultsPageUrl: new URL("RESULTS.aspx", root).toString(),
        activeNepResultUrl: new URL("NEP_RESULT.aspx", root).toString()
      });
    }

    if (action === "add_probe_roll") {
      const rollNo = req.query.rollNo;
      const yearPart = req.query.yearPart;
      const resultType = req.query.resultType || "MAIN";

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
          resultType,
          active: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        },
        {
          merge: true
        }
      );

      return res.status(200).json({
        success: true,
        message: "Probe roll added successfully",
        id,
        rollNo,
        yearPart,
        resultType
      });
    }

    if (action === "clear_active_portal") {
      await db.collection("result_sources").doc("pdusu_main").set(
        {
          activeResultBaseUrl: "",
          activeResultsPageUrl: "",
          activeNepResultUrl: "",
          status: "discovering",
          manualSet: false,
          updatedAt: FieldValue.serverTimestamp()
        },
        {
          merge: true
        }
      );

      return res.status(200).json({
        success: true,
        message: "Active portal cleared successfully"
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
