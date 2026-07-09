import OpenAI from "openai";

export type EyeShape =
  | "round"
  | "almond"
  | "hooded"
  | "monolid"
  | "downturned"
  | "upturned"
  | "deep_set"
  | "close_set"
  | "wide_set";

export type LashDensity = "sparse" | "medium" | "dense";
export type LashLength = "short" | "medium" | "long";

export interface EyeAnalysis {
  eye_shape: EyeShape;
  lash_density: LashDensity;
  lash_length_natural: LashLength;
  notes: string;
  mock: boolean;
}

const apiKey = process.env.OPENAI_API_KEY;
const client = apiKey ? new OpenAI({ apiKey }) : null;

if (!client) {
  console.warn(
    "[ai.service] No OPENAI_API_KEY configured — eye-analysis and the AI Lash Coach will " +
      "return deterministic mock responses instead of calling OpenAI.",
  );
}

const EYE_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    eye_shape: {
      type: "string",
      enum: [
        "round",
        "almond",
        "hooded",
        "monolid",
        "downturned",
        "upturned",
        "deep_set",
        "close_set",
        "wide_set",
      ],
    },
    lash_density: { type: "string", enum: ["sparse", "medium", "dense"] },
    lash_length_natural: { type: "string", enum: ["short", "medium", "long"] },
    notes: { type: "string" },
  },
  required: ["eye_shape", "lash_density", "lash_length_natural", "notes"],
  additionalProperties: false,
};

export async function analyzeEye(imageBuffer: Buffer): Promise<EyeAnalysis> {
  if (!client) {
    return {
      eye_shape: "almond",
      lash_density: "medium",
      lash_length_natural: "medium",
      notes: "MOCK RESPONSE — no OPENAI_API_KEY configured. This is a placeholder, not a real analysis.",
      mock: true,
    };
  }

  const base64Image = imageBuffer.toString("base64");
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a lash artistry vision assistant. Classify the client's eye shape and " +
          "natural lash characteristics from the photo. Only classify what you can see — " +
          "do not invent details.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this client eye photo." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "eye_analysis", schema: EYE_ANALYSIS_SCHEMA, strict: true },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI vision call returned no content");
  }

  const parsed = JSON.parse(raw) as Omit<EyeAnalysis, "mock">;
  return { ...parsed, mock: false };
}

const COACH_SYSTEM_PROMPT =
  "You are the LashlyAI Lash Coach. You only answer questions about lash extension " +
  "application, troubleshooting, retention, and technique (e.g. fanning, isolation, " +
  "adhesive curing, aftercare). If asked about anything unrelated to lash artistry, " +
  "politely decline and redirect to lash topics.";

export async function askCoach(question: string): Promise<{ answer: string; mock: boolean }> {
  if (!client) {
    return {
      answer:
        "MOCK RESPONSE — no OPENAI_API_KEY configured. In production this would be a real " +
        `answer to: "${question}"`,
      mock: true,
    };
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: COACH_SYSTEM_PROMPT },
      { role: "user", content: question },
    ],
  });

  const answer = completion.choices[0]?.message?.content ?? "";
  return { answer, mock: false };
}
