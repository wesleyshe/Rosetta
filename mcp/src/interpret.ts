// interpret(): pass post-action media (screenshot, audio in future) to a
// vision/audio model with a question, return the answer string.
//
// Phase 4 implements anthropic only. Other providers throw
// "provider_not_implemented". Provider selection via env:
//
//   ROSETTA_INTERPRET_PROVIDER  = "anthropic" (default) | "openai" | "gemini"
//   ROSETTA_INTERPRET_MODEL     = override default model
//   ROSETTA_ANTHROPIC_API_KEY   = required when provider is anthropic
//                                 (falls back to ANTHROPIC_API_KEY)
//
// Default model is claude-haiku-4-5 — fast + vision-capable. Verifications
// are low-stakes yes/no answers; haiku is the right grade for this.

export interface InterpretInput {
  /** Base64-encoded PNG. Required for image-based interpretation. */
  image_base64?: string;
  /** Base64-encoded audio. Reserved for future use (Phase 7+). */
  audio_base64?: string;
  /** Natural-language question to ask about the media. */
  question: string;
  /** Optional override for the provider's default model. */
  model?: string;
}

export interface InterpretOutput {
  answer: string;
  provider: string;
  model: string;
}

const DEFAULTS: Record<string, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
  gemini: "gemini-1.5-flash",
};

export async function interpret(input: InterpretInput): Promise<InterpretOutput> {
  const provider = (process.env.ROSETTA_INTERPRET_PROVIDER ?? "anthropic").toLowerCase();
  const model = input.model ?? process.env.ROSETTA_INTERPRET_MODEL ?? DEFAULTS[provider] ?? DEFAULTS.anthropic;

  switch (provider) {
    case "anthropic":
      return await callAnthropic(input, model);
    case "openai":
    case "gemini":
      throw new Error(`provider_not_implemented: ${provider} (Phase 4 implements anthropic only)`);
    default:
      throw new Error(`unknown interpret provider: ${provider}`);
  }
}

async function callAnthropic(input: InterpretInput, model: string): Promise<InterpretOutput> {
  if (input.audio_base64) {
    throw new Error("audio interpretation not yet supported (Phase 7+)");
  }
  if (!input.image_base64) {
    throw new Error("interpret: image_base64 required for image-based interpretation");
  }

  const apiKey = process.env.ROSETTA_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "interpret: ROSETTA_ANTHROPIC_API_KEY (or ANTHROPIC_API_KEY) is not set"
    );
  }

  const body = {
    model,
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: input.image_base64,
            },
          },
          {
            type: "text",
            text:
              input.question +
              "\n\nAnswer in 1-2 short sentences, optionally followed by a final " +
              'line that is just "yes" or "no" if the question is yes/no in nature.',
          },
        ],
      },
    ],
  };

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`anthropic api ${r.status}: ${text.slice(0, 500)}`);
  }
  const data = (await r.json()) as { content: Array<{ type: string; text?: string }>; model: string };
  const text =
    data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() ?? "";

  return { answer: text, provider: "anthropic", model: data.model ?? model };
}
