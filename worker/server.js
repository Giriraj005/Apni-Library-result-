import express from "express";
import {
  fetchResultWithBrowser,
  fetchOptionsWithBrowser
} from "./resultFetcher.js";

const app = express();

app.use(express.json({ limit: "1mb" }));

function requireWorkerSecret(req, res, next) {
  const secret =
    req.query.secret ||
    req.headers["x-worker-secret"] ||
    req.body?.secret;

  if (!process.env.WORKER_SECRET || secret !== process.env.WORKER_SECRET) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized worker request"
    });
  }

  next();
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "PDUSU Result Worker",
    status: "online"
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    time: new Date().toISOString()
  });
});

app.get("/fetch-options", requireWorkerSecret, async (req, res) => {
  try {
    const url = String(req.query.url || "").trim();

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "url is required"
      });
    }

    const result = await fetchOptionsWithBrowser({ url });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Fetch options failed"
    });
  }
});

app.get("/fetch-result", requireWorkerSecret, async (req, res) => {
  try {
    const rollNo = String(req.query.rollNo || "").trim();
    const yearPart = String(req.query.yearPart || "").trim();
    const resultType = String(req.query.resultType || "MAIN").trim();
    const formUrl = String(
      req.query.formUrl ||
        "https://result26.shekhauniexam.in/PG_NEP_RESULT.aspx"
    ).trim();

    if (!rollNo || !yearPart) {
      return res.status(400).json({
        success: false,
        error: "rollNo and yearPart are required"
      });
    }

    const result = await fetchResultWithBrowser({
      rollNo,
      yearPart,
      resultType,
      formUrl
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Worker failed"
    });
  }
});

app.post("/fetch-result", requireWorkerSecret, async (req, res) => {
  try {
    const body = req.body || {};

    const rollNo = String(body.rollNo || "").trim();
    const yearPart = String(body.yearPart || "").trim();
    const resultType = String(body.resultType || "MAIN").trim();
    const formUrl = String(
      body.formUrl ||
        "https://result26.shekhauniexam.in/PG_NEP_RESULT.aspx"
    ).trim();

    if (!rollNo || !yearPart) {
      return res.status(400).json({
        success: false,
        error: "rollNo and yearPart are required"
      });
    }

    const result = await fetchResultWithBrowser({
      rollNo,
      yearPart,
      resultType,
      formUrl
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Worker failed"
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`PDUSU Result Worker running on port ${port}`);
});
