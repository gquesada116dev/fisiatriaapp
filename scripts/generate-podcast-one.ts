/**
 * Generates the podcast for a single topic slug.
 * Usage: tsx scripts/generate-podcast-one.ts anatomia-musculoesqueletica-aplicada
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";
import { podcastPrompt, type PodcastLine } from "../lib/ai/prompts";
import { AI_MODELS, MAX_TOKENS } from "../lib/ai/config";
import { synthesizePodcast } from "../lib/audio/elevenlabs";
import { uploadToR2 } from "./r2-upload";

if (!getApps().length) {
  const pk = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "";
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: pk,
    }),
  });
}

const db = getFirestore();
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const slug = process.argv[2];
if (!slug) { console.error("Usage: tsx scripts/generate-podcast-one.ts <slug>"); process.exit(1); }

async function main() {
  const topicSnap = await db.collection("topics").doc(slug).get();
  if (!topicSnap.exists) { console.error(`Topic not found: ${slug}`); process.exit(1); }
  const topic = { slug, ...topicSnap.data() } as any;

  const existing = await db.collection("podcasts").doc(slug).get();
  if (existing.exists) { console.log("Podcast ya existe — borrando para regenerar..."); await db.collection("podcasts").doc(slug).delete(); }

  console.log(`Generando script para: ${topic.name}...`);
  const { system, user } = podcastPrompt(topic);
  const resp = await ai.messages.create({
    model: AI_MODELS.podcastScript,
    max_tokens: MAX_TOKENS.podcastScript,
    system,
    messages: [{ role: "user", content: user }],
  });
  const raw = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text).join("").trim()
    .replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
  const { script } = JSON.parse(raw) as { script: PodcastLine[] };
  console.log(`  Script: ${script.length} líneas`);

  console.log("Sintetizando audio con ElevenLabs...");
  const voiceA = process.env.ELEVENLABS_VOICE_HOST_A!;
  const voiceB = process.env.ELEVENLABS_VOICE_HOST_B!;
  const mp3 = await synthesizePodcast(script, { a: voiceA, b: voiceB });
  console.log(`  Audio: ${(mp3.length / 1024).toFixed(0)} KB`);

  console.log("Subiendo a Cloudflare R2...");
  const audioKey = `podcasts/${slug}/${Date.now()}.mp3`;
  const audioUrl = await uploadToR2(audioKey, mp3, "audio/mpeg");

  await db.collection("podcasts").doc(slug).set({
    topicSlug: slug, script, audioKey, audioUrl,
    voiceA, voiceB, model: AI_MODELS.podcastScript,
    promptV: 1, createdAt: Timestamp.now(),
  });

  console.log(`✅ Podcast listo: ${topic.name}`);
  console.log(`   URL: ${audioUrl}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
