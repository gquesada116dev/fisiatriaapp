import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function initAdmin() {
  if (getApps().length > 0) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)");
  }
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
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

// Recomputes mastery from flashcardReviews: correct = lastQuality >= 3, incorrect = 0 or null.
export async function refreshMastery(topicSlug: string) {
  const firestore = db();
  const reviewsSnap = await firestore.collection("flashcardReviews").where("topicSlug", "==", topicSlug).get();
  const total = reviewsSnap.size;
  const correct = reviewsSnap.docs.filter((d) => (d.data().lastQuality ?? -1) >= 3).length;
  const mastery = total > 0 ? correct / total : 0;

  await firestore.collection("topicStats").doc(topicSlug).set(
    { correctCards: correct, totalCards: total, mastery, updatedAt: Timestamp.now() },
    { merge: true },
  );
}

// Builds the permanent Firebase Storage download URL.
export function storageDownloadUrl(bucket: string, path: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}
