import { requireAdmin, safeJsonError } from "../../lib/security";
import { logEvent } from "../../lib/logger";

async function callWorker({ formUrl, yearPart, resultType, rollNo, sendTelegram }) {
  if (!process.env.WORKER_URL) {
    throw new Error("WORKER_URL missing in Vercel env");
  }

  if (!process.env.WORKER_SECRET) {
    throw new Error("WORKER_SECRET missing in Vercel env");
  }

  const response = await fetch(`${process.env.WORKER_URL}/fetch-result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": process.env.WORKER_SECRET
    },
    body: JSON.stringify({
      formUrl,
      yearPart,
      resultType,
      rollNo,
      sendTelegram
    })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Worker result fetch failed");
  }

  return data;
}

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const formUrl =
      req.body?.resultFormUrl || "https://result25.shekhauni.co.in/NEP_RESULT.aspx";

    const yearPart = req.body?.yearPart;
    const resultType = req.body?.resultType || "MAIN";
    const rollNo = req.body?.rollNo;

    if (!formUrl || !yearPart || !rollNo) {
      return res.status(400).json({
        success: false,
        error: "formUrl/yearPart/rollNo required"
      });
    }

    const workerResult = await callWorker({
      formUrl,
      yearPart,
      resultType,
      rollNo,
      sendTelegram: true
    });

    await logEvent("admin_test", "info", "Manual result test completed by worker", {
      formUrl,
      yearPart,
      resultType,
      rollNo,
      workerStatus: workerResult.status
    });

    return res.status(200).json({
      success: true,
      formUrl,
      resultStatus: {
        status: workerResult.status,
        resultFound: workerResult.resultFound,
        reason: workerResult.reason
      },
      selected: workerResult.selected,
      textPreview: workerResult.textPreview,
      telegramSent: workerResult.telegramSent,
      telegramMessageId: workerResult.telegramMessageId || null
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
