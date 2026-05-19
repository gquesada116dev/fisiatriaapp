import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  const pk = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "";
  initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID!, clientEmail: process.env.FIREBASE_CLIENT_EMAIL!, privateKey: pk }) });
}

async function main() {
  const db = getFirestore();
  const snaps = await db.collection("podcasts").get();
  if (snaps.empty) { console.log("No hay podcasts."); process.exit(0); }
  const batch = db.batch();
  snaps.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`Borrados ${snaps.size} podcasts.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
