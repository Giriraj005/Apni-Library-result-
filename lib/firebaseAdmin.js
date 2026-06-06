import admin from "firebase-admin";

function normalizePrivateKey(key) {
  if (!key) return "";
  return key.replace(/\\n/g, "\n");
}

function initFirebaseAdmin() {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("Firebase Admin env vars missing. API routes using Firestore will fail until env vars are added.");
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

initFirebaseAdmin();

function getDb() {
  if (!admin.apps.length) {
    throw new Error("Firebase Admin is not initialized. Add Firebase environment variables in Vercel.");
  }

  return admin.firestore();
}

export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      return getDb()[prop];
    }
  }
);

export const FieldValue = admin.firestore.FieldValue;

export default admin;
