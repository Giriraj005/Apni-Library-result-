import { db, FieldValue } from "./firebaseAdmin";

export async function logEvent(module, level, message, data = {}) {
  try {
    await db.collection("result_logs").add({
      module,
      level,
      message,
      data,
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("logEvent failed", err);
  }
}
