import {
  cleanText as catalogCleanText,
  resolveYearPart
} from "./resultCourseCatalog";

export function requireCron(req) {
  const secret = req.query.secret || req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    const err = new Error("Unauthorized cron request");
    err.statusCode = 401;
    throw err;
  }
}

export function requireAdmin(req) {
  const secret = req.headers["x-admin-secret"] || req.query.admin || req.body?.adminSecret;
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    const err = new Error("Unauthorized admin request");
    err.statusCode = 401;
    throw err;
  }
}

export function cleanText(value) {
  return catalogCleanText(value);
}

export function normalizeRollNo(value) {
  return cleanText(value).replace(/[^0-9A-Za-z/-]/g, "").toUpperCase();
}

export function normalizeKey(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getYearPart(course, semester, yearPart = "") {
  return resolveYearPart({
    course,
    semester,
    yearPart
  });
}

export function safeJsonError(res, err) {
  const code = err.statusCode || 500;
  return res.status(code).json({
    success: false,
    error: err.message || "Internal error"
  });
}
