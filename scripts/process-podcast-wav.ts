/**
 * Processes a folder of ElevenLabs WAV paragraphs, calculates timestamps,
 * concatenates to MP3, uploads to Firebase, and updates Firestore.
 *
 * Usage:
 *   tsx scripts/process-podcast-wav.ts \
 *     --slug=amputaciones-extremidad-inferior \
 *     --type=pre \
 *     --folder=/path/to/ElevenLabs_export \
 *     [--jingle]   # pass if file 01 is a jingle with no script text
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { uploadToR2 } from "./r2-upload";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "",
    }),
  });
}

const db = getFirestore();

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const SLUG = arg("slug");
const TYPE = (arg("type") ?? "pre") as "pre" | "post";
const FOLDER = arg("folder");
const HAS_JINGLE = process.argv.includes("--jingle");

if (!SLUG || !FOLDER) {
  console.error("Uso: tsx scripts/process-podcast-wav.ts --slug=<slug> --type=pre|post --folder=/ruta [--jingle]");
  process.exit(1);
}

// WAV PCM header is 44 bytes; duration = (size - 44) / (sampleRate * channels * bytesPerSample)
function wavDurationS(filePath: string): number {
  const size = fs.statSync(filePath).size;
  // Read actual WAV header for accurate params
  const buf = Buffer.alloc(44);
  const fd = fs.openSync(filePath, "r");
  fs.readSync(fd, buf, 0, 44, 0);
  fs.closeSync(fd);
  const sampleRate = buf.readUInt32LE(24);
  const numChannels = buf.readUInt16LE(22);
  const bitsPerSample = buf.readUInt16LE(34);
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = size - 44;
  return dataSize / (sampleRate * numChannels * bytesPerSample);
}

function readWavPcm(filePath: string): Buffer {
  const full = fs.readFileSync(filePath);
  return full.slice(44); // strip 44-byte header, keep raw PCM
}

function writeWav(pcm: Buffer, filePath: string, sampleRate = 44100, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);         // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  fs.writeFileSync(filePath, Buffer.concat([header, pcm]));
}

async function main() {
  // 1. Collect WAV files sorted numerically
  const wavFiles = fs.readdirSync(FOLDER!)
    .filter((f) => f.toLowerCase().endsWith(".wav") && !f.startsWith("_"))
    .sort()
    .map((f) => path.join(FOLDER!, f));

  console.log(`\n📂 ${wavFiles.length} archivos WAV en ${FOLDER}`);

  // 2. Load script JSON
  const scriptPath = path.join(__dirname, "podcast-sources", `${SLUG}--${TYPE}.json`);
  if (!fs.existsSync(scriptPath)) {
    console.error(`Script no encontrado: ${scriptPath}`);
    process.exit(1);
  }
  const scriptLines: { speaker: string; text: string }[] = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  console.log(`📝 ${scriptLines.length} líneas en el script`);

  // 3. Determine which WAV files map to script lines
  const jingleFiles = HAS_JINGLE ? wavFiles.slice(0, 1) : [];
  const contentFiles = HAS_JINGLE ? wavFiles.slice(1) : wavFiles;

  if (contentFiles.length !== scriptLines.length) {
    console.warn(`⚠️  Mismatch: ${contentFiles.length} WAVs de contenido vs ${scriptLines.length} líneas de script`);
    console.warn("   Ajusta --jingle o revisa el script JSON.");
    if (Math.abs(contentFiles.length - scriptLines.length) > 2) process.exit(1);
  }

  // 4. Calculate timestamps
  let offset = 0;
  const jingleDurations = jingleFiles.map(wavDurationS);
  for (const d of jingleDurations) offset += d;

  const timedScript = scriptLines.map((line, i) => {
    const wavFile = contentFiles[i];
    const duration = wavFile ? wavDurationS(wavFile) : 0;
    const startS = Math.round(offset * 100) / 100;
    offset += duration;
    const endS = Math.round(offset * 100) / 100;
    return { ...line, startS, endS };
  });

  const totalS = offset;
  console.log(`\n⏱  Duración total: ${Math.floor(totalS / 60)}m ${Math.round(totalS % 60)}s`);
  timedScript.forEach((l, i) =>
    console.log(`  ${String(i + 1).padStart(2)} [${l.startS.toFixed(1)}s] (${l.speaker}) ${l.text.slice(0, 60)}…`)
  );

  // 5. Concatenate all WAVs to a single WAV
  console.log("\n🔗 Concatenando WAVs...");
  const allPcm = wavFiles.map(readWavPcm);
  const combined = Buffer.concat(allPcm);
  const tmpWav = path.join(FOLDER!, "_combined.wav");
  writeWav(combined, tmpWav);
  console.log(`   WAV combinado: ${(fs.statSync(tmpWav).size / 1024 / 1024).toFixed(1)} MB`);

  // 6. Convert to MP3 using ffmpeg-static
  console.log("🎵 Convirtiendo a MP3...");
  const ffmpeg = require("ffmpeg-static") as string;
  const tmpMp3 = path.join(FOLDER!, "_combined.mp3");
  execFileSync(ffmpeg, ["-y", "-i", tmpWav, "-codec:a", "libmp3lame", "-b:a", "128k", tmpMp3]);
  const mp3Size = fs.statSync(tmpMp3).size;
  console.log(`   MP3: ${(mp3Size / 1024 / 1024).toFixed(1)} MB`);

  // 7. Upload MP3 to Cloudflare R2
  console.log("☁️  Subiendo a Cloudflare R2...");
  const mp3 = fs.readFileSync(tmpMp3);
  const audioKey = `${SLUG}/${TYPE}-${Date.now()}.mp3`;
  const audioUrl = await uploadToR2(audioKey, mp3, "audio/mpeg");
  console.log(`   URL: ${audioUrl.slice(0, 80)}…`);

  // 8. Save to Firestore
  const docId = TYPE === "pre" ? `${SLUG}--pre` : SLUG!;
  await db.collection("podcasts").doc(docId).set({
    topicSlug: SLUG,
    script: timedScript,
    audioUrl,
    audioKey,
    durationS: Math.round(totalS),
    model: "elevenlabs-manual",
    promptV: "pdf-v2",
    updatedAt: Timestamp.now(),
  }, { merge: true });

  // 9. Cleanup temp files
  fs.unlinkSync(tmpWav);
  fs.unlinkSync(tmpMp3);

  console.log(`\n✅ Podcast ${TYPE} guardado en Firebase con timestamps.`);
  console.log(`   Doc: podcasts/${docId}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
