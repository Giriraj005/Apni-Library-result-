export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode,
  bodyParams = []
}) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is missing");
  }

  if (!token) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is missing");
  }

  if (!to) {
    throw new Error("WhatsApp recipient number is missing");
  }

  const template = {
    name: templateName || process.env.WHATSAPP_TEMPLATE_NAME || "hello_world",
    language: {
      code: languageCode || process.env.WHATSAPP_TEMPLATE_LANG || "en_US"
    }
  };

  if (bodyParams.length > 0) {
    template.components = [
      {
        type: "body",
        parameters: bodyParams.map((value) => ({
          type: "text",
          text: String(value || "")
        }))
      }
    ];
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
        to,
        type: "template",
        template
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "WhatsApp message failed");
  }

  return data;
}

export async function sendWhatsAppHelloWorld(to) {
  return sendWhatsAppTemplate({
    to,
    templateName: "hello_world",
    languageCode: "en_US",
    bodyParams: []
  });
}

export function getWhatsAppAdminNumbers() {
  const multiNumbers = process.env.WHATSAPP_ADMIN_NUMBERS || "";
  const singleNumber = process.env.WHATSAPP_ADMIN_NUMBER || "";

  const numbers = multiNumbers
    ? multiNumbers.split(",").map((n) => n.trim()).filter(Boolean)
    : [singleNumber].filter(Boolean);

  return [...new Set(numbers)];
}

export async function sendWhatsAppHelloWorldToAdmins() {
  const numbers = getWhatsAppAdminNumbers();
  const results = [];

  for (const to of numbers) {
    try {
      const result = await sendWhatsAppHelloWorld(to);

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

export async function sendWhatsAppResultAlertToAdmins({
  title,
  link,
  fallbackToHelloWorld = true
}) {
  const numbers = getWhatsAppAdminNumbers();
  const results = [];

  for (const to of numbers) {
    try {
      let result;

      if ((process.env.WHATSAPP_TEMPLATE_NAME || "hello_world") === "hello_world") {
        result = await sendWhatsAppHelloWorld(to);
      } else {
        result = await sendWhatsAppTemplate({
          to,
          templateName: process.env.WHATSAPP_TEMPLATE_NAME,
          languageCode: process.env.WHATSAPP_TEMPLATE_LANG || "en",
          bodyParams: [title || "PDUSU Result Alert", link || "Official result link"]
        });
      }

      results.push({
        to,
        success: true,
        result
      });
    } catch (err) {
      if (fallbackToHelloWorld && (process.env.WHATSAPP_TEMPLATE_NAME || "") !== "hello_world") {
        try {
          const fallback = await sendWhatsAppHelloWorld(to);

          results.push({
            to,
            success: true,
            fallback: true,
            result: fallback
          });

          continue;
        } catch (fallbackErr) {
          results.push({
            to,
            success: false,
            error: `${err.message}; fallback failed: ${fallbackErr.message}`
          });

          continue;
        }
      }

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
