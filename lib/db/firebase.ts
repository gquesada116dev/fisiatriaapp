import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function initAdmin() {
  if (getApps().length > 0) return;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON env var is required");
  initializeApp({
    credential: cert(JSON.parse(json)),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export function db() {
  initAdmin();
  return getFirestore();
}

export function storageBucket() {
  initAdmin();
  return getStorage().bucket();
}

export { Timestamp, FieldValue };

export function computeMastery(
  totalCards: number,
  matureCards: number,
  mcqAttempts: number,
  mcqCorrect: number,
): number {
  const cardMastery = totalCards > 0 ? matureCards / totalCards : 0;
  const mcqAccuracy = mcqAttempts >= 5 ? mcqCorrect / mcqAttempts : 0;
  return Math.min(1, 0.6 * cardMastery + 0.4 * mcqAccuracy);
}

// Recomputes and stores mastery from the running totals already in topicStats.
export async function refreshMastery(topicSlug: string) {
  const firestore = db();
  const ref = firestore.collection("topicStats").doc(topicSlug);
  await firestore.runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    const s = snap.data() ?? {};
    const mastery = computeMastery(
      s.totalCards ?? 0,
      s.matureCards ?? 0,
      s.mcqAttempts ?? 0,
      s.mcqCorrect ?? 0,
    );
    if (snap.exists) {
      txn.update(ref, { mastery, updatedAt: Timestamp.now() });
    } else {
      txn.set(ref, { totalCards: 0, matureCards: 0, mcqAttempts: 0, mcqCorrect: 0, mastery, updatedAt: Timestamp.now() });
    }
  });
}

// Builds the permanent Firebase Storage download URL.
export function storageDownloadUrl(bucket: string, path: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}
