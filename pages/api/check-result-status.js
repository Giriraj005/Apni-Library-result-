import { db } from "../../lib/firebaseAdmin";
import { normalizeRollNo, safeJsonError } from "../../lib/security";

function statusMessage(status) {
  const map = {
    waiting: [
      "Waiting",
      "Result abhi official portal par live nahi hua hai. System har 5 minutes check kar raha hai."
    ],
    portal_found: [
      "Portal Found",
      "Latest result portal mil gaya hai. Result confirmation ka wait hai."
    ],
    result_detected: [
      "Result Signal Detected",
      "Result related update mila hai. Final confirmation ke baad queue start hogi."
    ],
    in_queue: [
      "In Queue",
      "Result live hai. Aapka roll number queue me hai."
    ],
    checking: [
      "Checking",
      "Aapka roll number official portal par check ho raha hai."
    ],
    result_found: [
      "Result Found",
      "Result mil gaya hai. Preview private Telegram group me send ki ja chuki hai ya send ho rahi hai."
    ],
    not_found: [
      "Not Found",
      "Is roll number par result nahi mila. Details galat ho sakti hain ya university server response incomplete tha."
    ],
    failed_retrying: [
      "Retrying",
      "University server busy/slow tha. System automatic retry karega."
    ],
    wrong_details_suspected: [
      "Check Details",
      "Course/semester/roll number galat ho sakta hai. Admin se contact karein."
    ]
  };

  return map[status] || ["Unknown", "Status update available nahi hai."];
}

export default async function handler(req, res) {
  try {
    const rollNo = normalizeRollNo(req.query.rollNo);

    if (!rollNo) {
      return res.status(400).json({
        success: false,
        error: "Roll number required"
      });
    }

    const snap = await db
      .collection("result_registrations")
      .where("rollNo", "==", rollNo)
      .limit(10)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        success: false,
        error: "No registration found for this roll number"
      });
    }

    const registrations = [];

    for (const doc of snap.docs) {
      const data = doc.data();

      let output = null;

      if (data.resultId) {
        const out = await db.collection("result_outputs").doc(data.resultId).get();

        if (out.exists) {
          output = out.data();
        }
      }

      registrations.push({
        id: doc.id,
        ...data,
        output
      });
    }

    const primary = registrations[0];
    const [title, message] = statusMessage(primary.status);

    return res.status(200).json({
      success: true,
      title,
      message,
      status: primary.status,
      registrations
    });
  } catch (err) {
    return safeJsonError(res, err);
  }
}
