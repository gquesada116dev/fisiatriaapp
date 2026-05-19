import { NextResponse } from "next/server";
import { db, storageBucket, Timestamp, storageDownloadUrl } from "@/lib/db/firebase";
import { generateJson } from "@/lib/ai/client";
import { podcastPrompt, type PodcastLine } from "@/lib/ai/prompts";
import { AI_MODELS, MAX_TOKENS, PROMPT_VERSIONS } from "@/lib/ai/config";
import { synthesizePodcast } from "@/lib/audio/elevenlabs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const firestore = db();
  const topicSnap = await firestore.collection("topics").doc(slug).get();
  if (!topicSnap.exists) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  const podSnap = await firestore.collection("podcasts").doc(slug).get();
  if (!podSnap.exists) return NextResponse.json({ exists: false });

  const pod = podSnap.data()!;
  return NextResponse.json({ exists: true, audioUrl: pod.audioUrl, script: pod.script, durationS: pod.durationS ?? null });
}

export async function POST(req: Request) {
  const { slug } = (await req.json()) as { slug: string };
  const firestore = db();

  const topicSnap = await firestore.collection("topics").doc(slug).get();
  if (!topicSnap.exists) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  const topic = { slug, ...topicSnap.data() } as any;

  const existingSnap = await firestore.collection("podcasts").doc(slug).get();
  if (existingSnap.exists) {
    const pod = existingSnap.data()!;
    return NextResponse.json({ existed: true, audioUrl: pod.audioUrl, script: pod.script });
  }

  const { system, user } = podcastPrompt(topic);
  const { script } = await generateJson<{ script: PodcastLine[] }>({
    model: AI_MODELS.podcastScript,
    system,
    prompt: user,
    maxTokens: MAX_TOKENS.podcastScript,
  });

  const voiceA = process.env.ELEVENLABS_VOICE_HOST_A!;
  const voiceB = process.env.ELEVENLABS_VOICE_HOST_B!;
  if (!voiceA || !voiceB) {
    return NextResponse.json({ error: "ElevenLabs voice IDs not configured" }, { status: 500 });
  }
  const mp3 = await synthesizePodcast(script, { a: voiceA, b: voiceB });

  const audioPath = `${slug}/${Date.now()}.mp3`;
  const downloadToken = crypto.randomUUID();
  const bucket = storageBucket();

  await bucket.file(audioPath).save(mp3, {
    metadata: {
      contentType: "audio/mpeg",
      cacheControl: "public, max-age=31536000",
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  const audioUrl = storageDownloadUrl(bucket.name, audioPath, downloadToken);

  await firestore.collection("podcasts").doc(slug).set({
    topicSlug: slug,
    script,
    audioPath,
    audioUrl,
    voiceA,
    voiceB,
    model: AI_MODELS.podcastScript,
    promptV: PROMPT_VERSIONS.podcastScript,
    createdAt: Timestamp.now(),
  });

  return NextResponse.json({ existed: false, audioUrl, script });
}
