/**
 * ElevenLabs TTS client.
 *
 * Requests PCM audio per line, concatenates the raw samples, then encodes the
 * whole thing as a single MP3 stream using lamejs. This produces a file with a
 * proper Xing/Info header so browsers can seek accurately.
 */

import type { PodcastLine } from "@/lib/ai/prompts";
// @ts-ignore — lamejs has no types
import lamejs from "lamejs";

const API_BASE = "https://api.elevenlabs.io/v1";
const SAMPLE_RATE = 22050;
const CHANNELS = 1;
const KBITRATE = 64;

export type TtsVoices = { a: string; b: string };

export async function synthesizePodcast(
  lines: PodcastLine[],
  voices: TtsVoices,
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");
  const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

  // Collect PCM Int16 samples from all lines
  const allSamples: Int16Array[] = [];
  for (const line of lines) {
    const voiceId = line.speaker === "A" ? voices.a : voices.b;
    const pcm = await ttsLinePcm(line.text, voiceId, modelId, apiKey);
    allSamples.push(pcm);
    // 200ms silence between lines
    allSamples.push(new Int16Array(Math.floor(SAMPLE_RATE * 0.2)));
  }

  // Concatenate all samples into one buffer
  const totalLen = allSamples.reduce((n, a) => n + a.length, 0);
  const combined = new Int16Array(totalLen);
  let offset = 0;
  for (const s of allSamples) { combined.set(s, offset); offset += s.length; }

  // Encode as single MP3 stream with lamejs (produces seekable file with Xing header)
  const encoder = new lamejs.Mp3Encoder(CHANNELS, SAMPLE_RATE, KBITRATE);
  const mp3Parts: Uint8Array[] = [];
  const CHUNK = 1152; // lamejs requires multiples of 1152
  for (let i = 0; i < combined.length; i += CHUNK) {
    const chunk = combined.subarray(i, i + CHUNK);
    const encoded = encoder.encodeBuffer(chunk);
    if (encoded.length > 0) mp3Parts.push(new Uint8Array(encoded));
  }
  const flushed = encoder.flush();
  if (flushed.length > 0) mp3Parts.push(new Uint8Array(flushed));

  const totalBytes = mp3Parts.reduce((n, p) => n + p.length, 0);
  const mp3 = Buffer.allocUnsafe(totalBytes);
  let pos = 0;
  for (const p of mp3Parts) { mp3.set(p, pos); pos += p.length; }
  return mp3;
}

async function ttsLinePcm(
  text: string,
  voiceId: string,
  modelId: string,
  apiKey: string,
): Promise<Int16Array> {
  const url = `${API_BASE}/text-to-speech/${voiceId}?output_format=pcm_22050`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 300)}`);
  }
  const ab = await res.arrayBuffer();
  // PCM 16-bit LE signed
  return new Int16Array(ab);
}
