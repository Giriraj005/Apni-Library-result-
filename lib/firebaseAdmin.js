import admin from "firebase-admin";

function normalizePrivateKey(key) {
  if (!key) return "";
  return key.replace(/\\n/g, "\n");
}

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin environment variables");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;

export default admin;
