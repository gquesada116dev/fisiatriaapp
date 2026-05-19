import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function anthropic() {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

/** Extract concatenated text from a Messages API response. */
export function textFromResponse(resp: Anthropic.Message): string {
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Helper: ask Claude for JSON output.
 * We instruct the model to return JSON only; we strip ```json fences defensively.
 */
export async function generateJson<T>(args: {
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
}): Promise<T> {
  const resp = await anthropic().messages.create({
    model: args.model,
    max_tokens: args.maxTokens,
    system:
      args.system +
      "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no preamble, no commentary.",
    messages: [{ role: "user", content: args.prompt }],
  });
  let text = textFromResponse(resp).trim();
  // Strip accidental code fences.
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(
      `Claude returned invalid JSON. First 300 chars: ${text.slice(0, 300)}`,
    );
  }
}
