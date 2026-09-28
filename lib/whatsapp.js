function getWhatsAppConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is missing");
  }

  if (!token) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is missing");
  }

  return {
    phoneNumberId,
    token
  };
}

export function normalizeWhatsAppNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length === 10) return `91${digits}`;

  return digits;
}

function parseAdminNumbers() {
  const many = String(process.env.WHATSAPP_ADMIN_NUMBERS || "")
    .split(",")
    .map((x) => normalizeWhatsAppNumber(x))
    .filter(Boolean);

  const one = normalizeWhatsAppNumber(process.env.WHATSAPP_ADMIN_NUMBER);

  return [...new Set([...many, one].filter(Boolean))];
}

function trimTemplateText(value, max = 900) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= max) return text;

  return `${text.slice(0, max - 3)}...`;
}

async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = "en_US",
  bodyParams = [],
  buttonUrlParam = ""
}) {
  const { phoneNumberId, token } = getWhatsAppConfig();

  const recipient = normalizeWhatsAppNumber(to);

  if (!recipient) {
    throw new Error("WhatsApp recipient number is missing");
  }

  if (!templateName) {
    throw new Error("WhatsApp template name is missing");
  }

  const components = [];

  if (bodyParams.length) {
    components.push({
      type: "body",
      parameters: bodyParams.map((value) => ({
        type: "text",
        text: trimTemplateText(value, 950)
      }))
    });
  }

  if (buttonUrlParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        {
          type: "text",
          text: buttonUrlParam
        }
      ]
    });
  }

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.error?.error_data?.details ||
        "WhatsApp template send failed"
    );
  }

  return data;
}

export async function sendWhatsAppFreeformText({ to, text }) {
  const { phoneNumberId, token } = getWhatsAppConfig();

  const recipient = normalizeWhatsAppNumber(to);

  if (!recipient) {
    throw new Error("WhatsApp recipient number is missing");
  }

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: {
          preview_url: true,
          body: String(text || "").slice(0, 3900)
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.error?.error_data?.details ||
        "WhatsApp free-form send failed"
    );
  }

  return data;
}

// Sends one text to every admin number. Free-form text is tried first (works
// while the admin has messaged your WhatsApp number in the last 24 hours). If
// that fails and a template name is given, the approved template is used.
export async function sendWhatsAppAdminText({
  text,
  templateName = "",
  templateParams = [],
  templateLang = ""
}) {
  const numbers = parseAdminNumbers();
  const results = [];

  for (const to of numbers) {
    try {
      const result = await sendWhatsAppFreeformText({ to, text });
      results.push({ to, success: true, method: "freeform", result });
    } catch (freeErr) {
      if (!templateName) {
        results.push({ to, success: false, error: freeErr.message });
        continue;
      }

      try {
        const result = await sendWhatsAppTemplate({
          to,
          templateName,
          languageCode:
            templateLang || process.env.WHATSAPP_TEMPLATE_LANG || "en_US",
          bodyParams: templateParams
        });

        results.push({ to, success: true, method: "template", result });
      } catch (tplErr) {
        results.push({
          to,
          success: false,
          error: `freeform: ${freeErr.message} | template: ${tplErr.message}`
        });
      }
    }
  }

  return {
    total: numbers.length,
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results
  };
}

// "N roll numbers are waiting for a CAPTCHA" ping, with a link to the admin page.
export async function sendWhatsAppCaptchaPing({ count, link }) {
  const text = [
    `🔐 ${count} roll number${count === 1 ? "" : "s"} waiting for a CAPTCHA`,
    "",
    "Open this and type the CAPTCHA:",
    link
  ].join("\n");

  return sendWhatsAppAdminText({
    text,
    templateName: process.env.WHATSAPP_CAPTCHA_TEMPLATE_NAME || "",
    templateLang: process.env.WHATSAPP_CAPTCHA_TEMPLATE_LANG || "",
    templateParams: [String(count), link]
  });
}

export async function sendWhatsAppResultAlertToAdmins({ title, link }) {
  const numbers = parseAdminNumbers();

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "hello_world";
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";

  const results = [];

  for (const to of numbers) {
    try {
      let result;

      if (templateName === "hello_world") {
        result = await sendWhatsAppTemplate({
          to,
          templateName,
          languageCode,
          bodyParams: []
        });
      } else {
        result = await sendWhatsAppTemplate({
          to,
          templateName,
          languageCode,
          bodyParams: [
            title || "PDUSU Result Update",
            link || "https://shekhauniexam.in/",
            "https://shekhauniexam.in/"
          ]
        });
      }

      results.push({
        to,
        success: true,
        result
      });
    } catch (err) {
      results.push({
        to,
        success: false,
        error: err.message
      });
    }
  }

  return {
    total: numbers.length,
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results
  };
}

function buildStudentFreeformMessage({
  rollNo,
  yearPart,
  resultSummary,
  officialUrl
}) {
  return [
    "✅ PDUSU Result Found",
    "",
    `Roll No: ${rollNo}`,
    `Course: ${yearPart}`,
    "",
    "Result Summary:",
    resultSummary,
    "",
    "Official Result Link:",
    officialUrl || "https://shekhauniexam.in/",
    "",
    "Please verify your full marksheet from the official university website.",
    "",
    "Apni Library"
  ].join("\n");
}

export async function sendWhatsAppStudentResultTemplate({
  to,
  rollNo,
  yearPart,
  resultSummary,
  officialUrl
}) {
  const templateName =
    process.env.WHATSAPP_STUDENT_RESULT_TEMPLATE_NAME ||
    "pdusu_result_status_v1";

  const languageCode =
    process.env.WHATSAPP_STUDENT_RESULT_TEMPLATE_LANG || "en_US";

  const result = await sendWhatsAppTemplate({
    to,
    templateName,
    languageCode,
    bodyParams: [
      rollNo,
      yearPart,
      resultSummary,
      officialUrl || "https://shekhauniexam.in/"
    ]
  });

  return {
    method: "template",
    to: normalizeWhatsAppNumber(to),
    success: true,
    result
  };
}

export async function sendWhatsAppStudentResultAuto({
  to,
  rollNo,
  yearPart,
  resultSummary,
  officialUrl
}) {
  const errors = [];

  try {
    const freeform = await sendWhatsAppFreeformText({
      to,
      text: buildStudentFreeformMessage({
        rollNo,
        yearPart,
        resultSummary,
        officialUrl
      })
    });

    return {
      method: "freeform",
      to: normalizeWhatsAppNumber(to),
      success: true,
      result: freeform
    };
  } catch (err) {
    errors.push({
      method: "freeform",
      error: err.message
    });
  }

  try {
    const template = await sendWhatsAppStudentResultTemplate({
      to,
      rollNo,
      yearPart,
      resultSummary,
      officialUrl
    });

    return {
      ...template,
      fallbackUsed: true,
      previousErrors: errors
    };
  } catch (err) {
    errors.push({
      method: "template",
      error: err.message
    });
  }

  return {
    method: "failed",
    to: normalizeWhatsAppNumber(to),
    success: false,
    error: errors.map((x) => `${x.method}: ${x.error}`).join(" | "),
    errors
  };
}

// ─── Hello World functions (whatsapp-test.js ke liye) ───────────────────────

export async function sendWhatsAppHelloWorld(to) {
  const recipient = typeof to === "string" ? to : to?.to || "";

  return sendWhatsAppTemplate({
    to: recipient,
    templateName: "hello_world",
    languageCode: "en_US",
    bodyParams: []
  });
}

export async function sendWhatsAppHelloWorldToAdmins() {
  const numbers = parseAdminNumbers();
  const results = [];

  for (const to of numbers) {
    try {
      const result = await sendWhatsAppHelloWorld(to);
      results.push({ to, success: true, result });
    } catch (err) {
      results.push({ to, success: false, error: err.message });
    }
  }

  return {
    total: numbers.length,
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results
  };
}
