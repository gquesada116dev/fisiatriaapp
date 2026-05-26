/**
 * Uploads a local MP3 to Firebase Storage and links it to the podcast doc.
 *
 * Usage:
 *   npm run upload:podcast -- --slug=amputaciones-extremidad-inferior --type=pre --file=/path/to/audio.mp3
 *   npm run upload:podcast -- --slug=amputaciones-extremidad-inferior --type=post --file=/path/to/audio.mp3
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "",
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const db = getFirestore();

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const SLUG = arg("slug");
const TYPE = (arg("type") ?? "post") as "pre" | "post";
const FILE = arg("file");

if (!SLUG || !FILE) {
  console.error("Uso: npm run upload:podcast -- --slug=<slug> --type=pre|post --file=/ruta/audio.mp3");
  process.exit(1);
}

if (!fs.existsSync(FILE)) {
  console.error(`Archivo no encontrado: ${FILE}`);
  process.exit(1);
}

async function main() {
  const mp3 = fs.readFileSync(FILE!);
  console.log(`Subiendo ${path.basename(FILE!)} (${(mp3.length / 1024 / 1024).toFixed(1)} MB)…`);

  const token = crypto.randomUUID();
  const audioPath = `${SLUG}/${TYPE}-${Date.now()}.mp3`;
  const bucket = getStorage().bucket();

  await bucket.file(audioPath).save(mp3, {
    metadata: {
      contentType: "audio/mpeg",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  const audioUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
    `${encodeURIComponent(audioPath)}?alt=media&token=${token}`;

  const docId = TYPE === "pre" ? `${SLUG}--pre` : SLUG;
  await db.collection("podcasts").doc(docId).update({ audioUrl, audioPath });

  console.log(`✓ Podcast ${TYPE} actualizado en Firebase`);
  console.log(`  URL: ${audioUrl.slice(0, 80)}…`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
