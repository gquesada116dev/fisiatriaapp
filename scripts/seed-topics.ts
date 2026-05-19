/**
 * Run with: npm run seed
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON and FIREBASE_STORAGE_BUCKET in .env.local
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SEED_TOPICS } from "../lib/db/seed-topics";

async function main() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON env var is required");

  initializeApp({ credential: cert(JSON.parse(json)) });
  const firestore = getFirestore();

  let count = 0;
  for (let i = 0; i < SEED_TOPICS.length; i++) {
    const t = SEED_TOPICS[i];
    await firestore
      .collection("topics")
      .doc(t.slug)
      .set({ ...t, sortOrder: i }, { merge: true });
    count++;
  }

  console.log(`Seeded ${count} topics.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
