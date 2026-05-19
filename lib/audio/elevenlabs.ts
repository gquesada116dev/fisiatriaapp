/**
 * ElevenLabs TTS client.
 *
 * Strategy: synthesize each line separately (so we can use different voices),
 * then concatenate the resulting MP3 buffers. MP3 frame concatenation works
 * because each chunk is a self-contained MPEG-1 Layer III stream; players
 * handle multi-stream MP3 fine. For perfectly clean output we could re-encode,
 * but for an internal study tool this is adequate.
 */

import type { PodcastLine } from "@/lib/ai/prompts";

const API_BASE = "https://api.elevenlabs.io/v1";

export type TtsVoices = { a: string; b: string };

export async function synthesizePodcast(
  lines: PodcastLine[],
  voices: TtsVoices,
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");
  const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

  const chunks: Buffer[] = [];
  for (const line of lines) {
    const voiceId = line.speaker === "A" ? voices.a : voices.b;
    const buf = await ttsLine(line.text, voiceId, modelId, apiKey);
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

async function ttsLine(
  text: string,
  voiceId: string,
  modelId: string,
  apiKey: string,
): Promise<Buffer> {
  const url = `${API_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
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
  return Buffer.from(ab);
}
