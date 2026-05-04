// interpret(): pass post-action media (screenshot, audio in future) to a
// vision/audio model with a question, return the answer string.
//
// As of Phase 7b#1.5 the use path no longer routes through this tool — the
// agent judges interpret_check verifications using its own vision (see
// verify.ts). interpret remains a niche escape hatch for callers that
// explicitly want a server-side LLM judgment.
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

import { readFile } from "node:fs/promises";

export interface InterpretInput {
  /** Base64-encoded image bytes (PNG or JPEG). Mutually exclusive with
   *  image_path; one of the two is required. */
  image_base64?: string;
  /** Filesystem path to the image. Read server-side and base64-encoded
   *  before the API call. Convenient when the caller already has a
   *  screenshot on disk (e.g. the path returned by os_screenshot). */
  image_path?: string;
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

/** Detect image media type from the first few bytes of the decoded base64.
 *  PNG signature is `89 50 4E 47`; everything else is treated as JPEG.
 *  Good enough for the two formats os_screenshot emits in v0. */
function detectImageMediaType(base64: string): "image/png" | "image/jpeg" {
  const head = Buffer.from(base64.slice(0, 16), "base64");
  if (
    head.length >= 4 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  ) {
    return "image/png";
  }
  return "image/jpeg";
}

async function callAnthropic(input: InterpretInput, model: string): Promise<InterpretOutput> {
  if (input.audio_base64) {
    throw new Error("audio interpretation not yet supported (Phase 7+)");
  }

  let imageBase64: string;
  if (input.image_path) {
    const buf = await readFile(input.image_path);
    imageBase64 = buf.toString("base64");
  } else if (input.image_base64) {
    imageBase64 = input.image_base64;
  } else {
    throw new Error("interpret: image_base64 or image_path required for image-based interpretation");
  }

  const apiKey = process.env.ROSETTA_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "interpret: ROSETTA_ANTHROPIC_API_KEY (or ANTHROPIC_API_KEY) is not set"
    );
  }

  const mediaType = detectImageMediaType(imageBase64);

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
              media_type: mediaType,
              data: imageBase64,
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
