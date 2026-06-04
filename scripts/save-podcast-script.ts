/**
 * Saves a pre-generated podcast script JSON to Firebase (no audio).
 * Usage: tsx scripts/save-podcast-script.ts --slug=rehabilitacion-cardiaca --type=pre
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID!, clientEmail: process.env.FIREBASE_CLIENT_EMAIL!, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") }) });
}

const db = getFirestore();
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const SLUG = arg("slug")!;
const TYPE = arg("type") ?? "pre";

async function main() {
  const jsonPath = path.join(__dirname, "podcast-sources", `${SLUG}--${TYPE}.json`);
  const script = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const docId = TYPE === "pre" ? `${SLUG}--pre` : SLUG;
  await db.collection("podcasts").doc(docId).set({
    topicSlug: SLUG, script,
    model: "claude-sonnet-4-6", promptV: "pdf-v2", createdAt: Timestamp.now(),
  }, { merge: true });
  console.log(`✓ ${docId} guardado en Firebase (sin audio, ${script.length} líneas)`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
