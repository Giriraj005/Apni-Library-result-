import { requireAdmin, safeJsonError, normalizeRollNo } from "../../lib/security";
import {
  resolveYearPart,
  getFormUrlForYearPart,
  resultTypeLabel
} from "../../lib/resultCourseCatalog";

function getWorkerUrl() {
  const url = process.env.WORKER_URL;

  if (!url) {
    throw new Error("WORKER_URL is missing");
  }

  return url.replace(/\/+$/, "");
}

function getWorkerSecret() {
  if (!process.env.WORKER_SECRET) {
    throw new Error("WORKER_SECRET is missing");
  }

  return process.env.WORKER_SECRET;
}

async function fetchResultFromWorker({ rollNo, yearPart, resultType, formUrl }) {
  const workerUrl = getWorkerUrl();
  const secret = getWorkerSecret();

  const response = await fetch(`${workerUrl}/fetch-result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": secret
    },
    body: JSON.stringify({
      secret,
      rollNo,
      yearPart,
      resultType,
      formUrl
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    throw new Error(
      data?.error || `Worker failed with status ${response.status}`
    );
  }

  return data;
}

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const input = req.method === "POST" ? req.body || {} : req.query || {};

    const rollNo = normalizeRollNo(input.rollNo);
    const course = input.course || "";
    const semester = input.semester || "";
    const yearPart = resolveYearPart({
      course,
      semester,
      yearPart: input.yearPart || input.courseOption || ""
    });

    const resultType = resultTypeLabel(input.resultType || "MAIN");
    const formUrl = input.formUrl || getFormUrlForYearPart(yearPart);

    if (!rollNo || !yearPart) {
      return res.status(400).json({
        success: false,
        error: "rollNo and yearPart/course are required"
      });
    }

    const workerResult = await fetchResultFromWorker({
      rollNo,
      yearPart,
      resultType,
      formUrl
    });

    if (!workerResult.success) {
      return res.status(200).json({
        success: false,
        source: "railway_worker",
        rollNo,
        yearPart,
        resultType,
        formUrl,
        error: workerResult.error || "Worker failed",
        workerResult
      });
    }

    return res.status(200).json({
      success: true,
      source: "railway_worker",
      rollNo,
      yearPart,
      resultType,
      formUrl,
      resultStatus: workerResult.resultStatus,
      resultFound: workerResult.resultFound,
      reason: workerResult.reason || "",
      selected: workerResult.selected || {},
      marksSummary: workerResult.marksSummary || "",
      textPreview: workerResult.textPreview || "",
      durationMs: workerResult.durationMs || null,
      workerResult
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
