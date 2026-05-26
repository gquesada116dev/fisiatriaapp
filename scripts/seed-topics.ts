/**
 * Run with: npm run seed
 * Run with: npm run seed -- --reset   (deletes all existing topics first)
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON in .env.local
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SEED_TOPICS } from "../lib/db/seed-topics";

const RESET = process.argv.includes("--reset");

async function deleteCollection(firestore: FirebaseFirestore.Firestore, colName: string) {
  const snap = await firestore.collection(colName).get();
  if (snap.empty) return;
  const batch = firestore.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`  Deleted ${snap.size} docs from "${colName}"`);
}

async function main() {
  const pk = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "";
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: pk,
    }),
  });
  const firestore = getFirestore();

  if (RESET) {
    console.log("⚠️  --reset: eliminando colección topics...");
    await deleteCollection(firestore, "topics");
  }

  let count = 0;
  for (let i = 0; i < SEED_TOPICS.length; i++) {
    const t = SEED_TOPICS[i];
    await firestore
      .collection("topics")
      .doc(t.slug)
      .set({ ...t, sortOrder: i }, { merge: true });
    count++;
    console.log(`  [${i + 1}/${SEED_TOPICS.length}] ${t.name}`);
  }

  console.log(`\n✅ Seeded ${count} topics.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
