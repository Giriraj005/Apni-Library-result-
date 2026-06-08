import { requireAdmin, safeJsonError } from "../../lib/security";
import {
  sendWhatsAppHelloWorld,
  sendWhatsAppHelloWorldToAdmins
} from "../../lib/whatsapp";
import { logEvent } from "../../lib/logger";

function getAdminNumbersFromRequest(req) {
  const to = req.body?.to || req.query.to;

  if (to) {
    return [String(to).trim()];
  }

  const multiNumbers = process.env.WHATSAPP_ADMIN_NUMBERS || "";
  const singleNumber = process.env.WHATSAPP_ADMIN_NUMBER || "";

  const numbers = multiNumbers
    ? multiNumbers.split(",").map((n) => n.trim()).filter(Boolean)
    : [singleNumber].filter(Boolean);

  return [...new Set(numbers)];
}

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    const requestSpecificNumbers = req.body?.to || req.query.to;

    if (!requestSpecificNumbers) {
      const result = await sendWhatsAppHelloWorldToAdmins();

      await logEvent("whatsapp", "info", "WhatsApp test sent to admin numbers", result);

      return res.status(200).json({
        success: true,
        ...result
      });
    }

    const numbers = getAdminNumbersFromRequest(req);

    const results = [];

    for (const to of numbers) {
      try {
        const result = await sendWhatsAppHelloWorld(to);

        results.push({
          to,
          success: true,
          result
        });

        await logEvent("whatsapp", "info", "WhatsApp test message sent", {
          to,
          result
        });
      } catch (err) {
        results.push({
          to,
          success: false,
          error: err.message
        });

        await logEvent("whatsapp", "error", "WhatsApp test message failed", {
          to,
          error: err.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      total: numbers.length,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
