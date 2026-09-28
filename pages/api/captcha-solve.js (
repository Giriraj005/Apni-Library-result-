hereimport { db, FieldValue } from "../../lib/firebaseAdmin";
import { requireAdmin, safeJsonError } from "../../lib/security";
import { getFormUrlForYearPart } from "../../lib/resultCourseCatalog";
import { logEvent } from "../../lib/logger";

/*
 * Backs /admin/captcha.
 *
 *   GET                       list queue items waiting for a CAPTCHA
 *   POST {action:"start"}     open the form on the worker, get the CAPTCHA image
 *   POST {action:"submit"}    send what the person typed
 *   POST {action:"cancel"}    close the worker session
 *   POST {action:"flush"}     run the normal queue now so alerts go out
 *
 * A person reads and types every CAPTCHA. Nothing here solves one.
 */

function workerBase() {
  const raw = String(process.env.WORKER_URL || "").trim();

  if (!raw) throw new Error("WORKER_URL is missing");

  return raw.replace(/\/+$/, "").replace(/\/fetch-result$/i, "");
}

async function callWorker(path, body) {
  const secret = process.env.WORKER_SECRET;

  if (!secret) throw new Error("WORKER_SECRET is missing");

  let response;

  try {
    response = await fetch(`${workerBase()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": secret
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000)
    });
  } catch (err) {
    throw new Error(`Worker network error: ${err.message || "Request failed"}`);
  }

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok || !data || data.success === false) {
    throw new Error(
      (data && data.error) || `Worker returned HTTP ${response.status}`
    );
  }

  return data;
}

async function loadItem(queueId) {
  if (!queueId) {
    const err = new Error("queueId is required");
    err.statusCode = 400;
    throw err;
  }

  const ref = db.collection("result_queue").doc(String(queueId));
  const snap = await ref.get();

  if (!snap.exists) {
    const err = new Error("Queue item not found");
    err.statusCode = 404;
    throw err;
  }

  return { ref, item: snap.data() };
}

async function getDob(item) {
  if (item.dateOfBirth) return item.dateOfBirth;
  if (!item.registrationId) return "";

  const snap = await db
    .collection("result_registrations")
    .doc(item.registrationId)
    .get();

  return snap.exists ? snap.data().dateOfBirth || "" : "";
}

// Turns the worker's final answer into a queue update.
async function handleDone({ ref, item }, result) {
  // Drop undefined values etc. so Firestore accepts it.
  const safe = JSON.parse(JSON.stringify(result));

  if (safe.resultFound) {
    // Hand it to the normal queue run, which saves the result and sends the
    // Telegram / WhatsApp alerts exactly as it does for automatic fetches.
    await ref.set(
      {
        status: "pending",
        resultFound: false,
        hasManualResult: true,
        manualWorkerResult: safe,
        workerResultStatus: safe.resultStatus || "",
        lastError: "",
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await logEvent("queue", "info", "Manual CAPTCHA result stored", {
      queueId: ref.id
    });

    return { state: "found" };
  }

  if (safe.resultStatus === "not_found") {
    await ref.set(
      {
        status: "not_found",
        resultFound: false,
        workerResultStatus: "not_found",
        lastError: safe.reason || "Result not found",
        lastTextPreview: safe.textPreview || "",
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    if (item.registrationId) {
      await db
        .collection("result_registrations")
        .doc(item.registrationId)
        .set(
          { status: "not_found", updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
    }

    return { state: "not_found", reason: safe.reason || "" };
  }

  // Could not tell what the page said: leave the item waiting for a CAPTCHA.
  return {
    state: "unclear",
    status: safe.resultStatus || "",
    reason: safe.reason || ""
  };
}

async function runQueueNow(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";

  const response = await fetch(`${proto}://${host}/api/process-result-queue`, {
    headers: { "x-cron-secret": process.env.CRON_SECRET || "" },
    signal: AbortSignal.timeout(55000)
  });

  const data = await response.json().catch(() => null);

  return { ok: response.ok, data };
}

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    if (req.method === "GET") {
      const snap = await db
        .collection("result_queue")
        .where("status", "==", "needs_captcha")
        .limit(50)
        .get();

      const items = snap.docs.map((doc) => {
        const x = doc.data();

        return {
          queueId: doc.id,
          rollNo: x.rollNo,
          yearPart: x.yearPart,
          resultType: x.resultType || "MAIN"
        };
      });

      return res.status(200).json({ success: true, items });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const body = req.body || {};
    const action = String(body.action || "");

    if (action === "start") {
      const ctx = await loadItem(body.queueId);
      const { item } = ctx;

      if (item.status === "result_found") {
        return res.status(409).json({
          success: false,
          error: "This result was already found"
        });
      }

      const out = await callWorker("/captcha/start", {
        rollNo: item.rollNo,
        yearPart: item.yearPart,
        resultType: item.resultType || "MAIN",
        formUrl: item.formUrl || getFormUrlForYearPart(item.yearPart),
        dob: await getDob(item)
      });

      if (out.state === "awaiting_captcha") {
        return res.status(200).json({
          success: true,
          state: "awaiting_captcha",
          sessionId: out.sessionId,
          imageBase64: out.imageBase64,
          fullPage: Boolean(out.fullPage)
        });
      }

      const done = await handleDone(ctx, out.result || {});

      return res.status(200).json({ success: true, ...done });
    }

    if (action === "submit") {
      const ctx = await loadItem(body.queueId);

      const out = await callWorker("/captcha/submit", {
        sessionId: body.sessionId,
        text: body.text
      });

      if (out.state === "expired") {
        return res.status(200).json({ success: true, state: "expired" });
      }

      if (out.state === "error") {
        return res.status(400).json({ success: false, error: out.error });
      }

      if (out.state === "captcha_rejected") {
        return res.status(200).json({
          success: true,
          state: "captcha_rejected",
          sessionId: out.sessionId,
          imageBase64: out.imageBase64,
          fullPage: Boolean(out.fullPage),
          reason: out.reason || ""
        });
      }

      const done = await handleDone(ctx, out.result || {});

      return res.status(200).json({ success: true, ...done });
    }

    if (action === "cancel") {
      if (body.sessionId) {
        await callWorker("/captcha/close", {
          sessionId: body.sessionId
        }).catch(() => {});
      }

      return res.status(200).json({ success: true });
    }

    if (action === "flush") {
      const out = await runQueueNow(req).catch((err) => ({
        ok: false,
        data: { error: err.message }
      }));

      return res.status(200).json({ success: true, ...out });
    }

    return res.status(400).json({ success: false, error: "Unknown action" });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
