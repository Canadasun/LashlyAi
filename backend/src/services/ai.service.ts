import OpenAI, { toFile } from "openai";
import { recommendGlue } from "./glueRecommendation.service";

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

const VALID_EYE_SHAPES: readonly EyeShape[] = [
  "round",
  "almond",
  "hooded",
  "monolid",
  "downturned",
  "upturned",
  "deep_set",
  "close_set",
  "wide_set",
];
const VALID_LASH_DENSITIES: readonly LashDensity[] = ["sparse", "medium", "dense"];

/**
 * The AI-generated analysis path is already schema-safe (strict OpenAI JSON schema),
 * but routes/clients.routes.ts also accepts a client-supplied eye_analysis object
 * directly — these guard against that unvalidated path reaching the rules engine
 * with a bad eye_shape/lash_density and crashing on an undefined lookup.
 */
export function isValidEyeShape(value: unknown): value is EyeShape {
  return VALID_EYE_SHAPES.includes(value as EyeShape);
}

export function isValidLashDensity(value: unknown): value is LashDensity {
  return VALID_LASH_DENSITIES.includes(value as LashDensity);
}

export type EyeWidthCategory = "narrow" | "average" | "wide";
export type EyeSizeCategory = "small" | "average" | "large";
export type EyeSpacing = "close_set" | "balanced" | "wide_set";
export type CanthalTilt = "upturned" | "neutral" | "downturned";
export type LidExposure = "hooded" | "balanced" | "prominent";
export type UnderEyeCondition = "taut" | "mild_puffiness" | "hollow" | "textured";
export type EyeSymmetry = "symmetric" | "mild_asymmetry" | "notable_asymmetry";
export type NaturalLashCurl = "straight" | "slight_curl" | "curled";
export type BrowShape = "straight" | "soft_angled" | "high_arch" | "s_shaped" | "flat";
export type BrowSpacing = "close" | "balanced" | "wide";
export type BrowTailLength = "short" | "medium" | "extended";
export type BrowGap = "tight" | "balanced" | "wide";
export type BrowHairDirection = "upward" | "outward" | "downward" | "mixed";

/**
 * Full consultation-grade analysis: eye_shape/lash_density/lash_length_natural feed
 * the deterministic lash-map rules engine (lashMapRules.data.ts) and must stay as-is;
 * every other field is presentation-only (labeled display + client-facing framing),
 * not consumed by any rules lookup, so they're safe to extend independently.
 */
export interface EyeAnalysis {
  eye_shape: EyeShape;
  lash_density: LashDensity;
  lash_length_natural: LashLength;
  eye_width: EyeWidthCategory;
  eye_size: EyeSizeCategory;
  eye_spacing: EyeSpacing;
  canthal_tilt: CanthalTilt;
  lid_exposure: LidExposure;
  under_eye_condition: UnderEyeCondition;
  eye_symmetry: EyeSymmetry;
  natural_lash_curl: NaturalLashCurl;
  brow_shape: BrowShape;
  brow_spacing: BrowSpacing;
  brow_tail_length: BrowTailLength;
  brow_gap: BrowGap;
  brow_hair_direction: BrowHairDirection;
  // AI-estimated 0-100 eye/brow balance score for consultation framing — not a
  // medical or diagnostic measurement.
  balance_score: number;
  notes: string;
  mock: boolean;
}

const apiKey = process.env.OPENAI_API_KEY;
// Explicit timeout/retry rather than SDK defaults: vision calls are slower than plain
// chat, and a bounded retry count keeps a flaky OpenAI response from hanging a request
// indefinitely. Retries only kick in on transient errors (network/429/5xx) — the SDK
// already skips retrying non-retryable 4xx errors.
const client = apiKey ? new OpenAI({ apiKey, timeout: 30_000, maxRetries: 2 }) : null;

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
    eye_width: { type: "string", enum: ["narrow", "average", "wide"] },
    eye_size: { type: "string", enum: ["small", "average", "large"] },
    eye_spacing: { type: "string", enum: ["close_set", "balanced", "wide_set"] },
    canthal_tilt: { type: "string", enum: ["upturned", "neutral", "downturned"] },
    lid_exposure: { type: "string", enum: ["hooded", "balanced", "prominent"] },
    under_eye_condition: {
      type: "string",
      enum: ["taut", "mild_puffiness", "hollow", "textured"],
    },
    eye_symmetry: {
      type: "string",
      enum: ["symmetric", "mild_asymmetry", "notable_asymmetry"],
    },
    natural_lash_curl: { type: "string", enum: ["straight", "slight_curl", "curled"] },
    brow_shape: {
      type: "string",
      enum: ["straight", "soft_angled", "high_arch", "s_shaped", "flat"],
    },
    brow_spacing: { type: "string", enum: ["close", "balanced", "wide"] },
    brow_tail_length: { type: "string", enum: ["short", "medium", "extended"] },
    brow_gap: { type: "string", enum: ["tight", "balanced", "wide"] },
    brow_hair_direction: {
      type: "string",
      enum: ["upward", "outward", "downward", "mixed"],
    },
    balance_score: { type: "integer", minimum: 0, maximum: 100 },
    notes: { type: "string" },
  },
  required: [
    "eye_shape",
    "lash_density",
    "lash_length_natural",
    "eye_width",
    "eye_size",
    "eye_spacing",
    "canthal_tilt",
    "lid_exposure",
    "under_eye_condition",
    "eye_symmetry",
    "natural_lash_curl",
    "brow_shape",
    "brow_spacing",
    "brow_tail_length",
    "brow_gap",
    "brow_hair_direction",
    "balance_score",
    "notes",
  ],
  additionalProperties: false,
};

export async function analyzeEye(imageBuffer: Buffer): Promise<EyeAnalysis> {
  if (!client) {
    return {
      eye_shape: "almond",
      lash_density: "medium",
      lash_length_natural: "medium",
      eye_width: "average",
      eye_size: "average",
      eye_spacing: "balanced",
      canthal_tilt: "neutral",
      lid_exposure: "balanced",
      under_eye_condition: "taut",
      eye_symmetry: "symmetric",
      natural_lash_curl: "slight_curl",
      brow_shape: "soft_angled",
      brow_spacing: "balanced",
      brow_tail_length: "medium",
      brow_gap: "balanced",
      brow_hair_direction: "outward",
      balance_score: 78,
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
          "You are a lash artistry consultation assistant performing a full eye and brow " +
          "analysis from the client's photo, the way an experienced lash artist would " +
          "assess a new client before mapping a design. Classify eye shape, size, width, " +
          "spacing, canthal tilt, lid exposure, under-eye condition, symmetry, and natural " +
          "lash density/length/curl, plus brow shape, spacing, tail length, gap, and hair " +
          "direction. Finish with a balance_score (0-100) estimating overall eye/brow " +
          "harmony for consultation framing — not a medical or diagnostic score. Only " +
          "classify what you can actually see in the photo — do not invent details, and " +
          "prefer the closest neutral/balanced category over guessing when a feature is " +
          "unclear or occluded.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this client eye and brow photo." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "eye_analysis", schema: EYE_ANALYSIS_SCHEMA, strict: true },
    },
    max_tokens: 600,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI vision call returned no content");
  }

  const parsed = JSON.parse(raw) as Omit<EyeAnalysis, "mock">;
  return { ...parsed, mock: false };
}

export interface PhotoFeedback {
  isolation_score: number;
  direction_score: number;
  styling_score: number;
  overall_score: number;
  notes: string;
  mock: boolean;
}

const PHOTO_FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    isolation_score: { type: "integer", minimum: 0, maximum: 100 },
    direction_score: { type: "integer", minimum: 0, maximum: 100 },
    styling_score: { type: "integer", minimum: 0, maximum: 100 },
    overall_score: { type: "integer", minimum: 0, maximum: 100 },
    notes: { type: "string" },
  },
  required: ["isolation_score", "direction_score", "styling_score", "overall_score", "notes"],
  additionalProperties: false,
};

const PHOTO_FEEDBACK_SYSTEM_PROMPT =
  "You are a lash artistry vision assistant reviewing a photo of an artist's COMPLETED " +
  "lash extension application (not a bare natural eye — this is finished work). Score " +
  "isolation (0-100: are individual lashes cleanly separated, any visible stickies?), " +
  "direction (0-100: consistent, deliberate fan/extension direction, symmetric between " +
  "eyes), and styling (0-100: coherent shape, smooth density/length transitions). Give " +
  "an overall_score that reflects your holistic judgment, not necessarily a simple " +
  "average — a severe isolation problem is a real lash-health risk and should weigh " +
  "heavily. Only score what you can actually see in the photo.";

/**
 * Scores a photo of the artist's own finished lash work — distinct from analyzeEye,
 * which scores the client's pre-work natural eye. See docs/lash-rules.md §7 for the
 * scoring rubric this prompt is based on.
 */
export async function scoreLashPhoto(imageBuffer: Buffer): Promise<PhotoFeedback> {
  if (!client) {
    return {
      isolation_score: 75,
      direction_score: 75,
      styling_score: 75,
      overall_score: 75,
      notes: "MOCK RESPONSE — no OPENAI_API_KEY configured. This is a placeholder, not real feedback.",
      mock: true,
    };
  }

  const base64Image = imageBuffer.toString("base64");
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: PHOTO_FEEDBACK_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Score this completed lash application photo." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "photo_feedback", schema: PHOTO_FEEDBACK_SCHEMA, strict: true },
    },
    max_tokens: 400,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI vision call returned no content");
  }

  const parsed = JSON.parse(raw) as Omit<PhotoFeedback, "mock">;
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
    max_tokens: 500,
  });

  const answer = completion.choices[0]?.message?.content ?? "";
  return { answer, mock: false };
}

export interface RetentionCheckInput {
  daysSinceApplication: number;
  retentionPct: number;
  symptoms: string[];
  // Optional context tying this check to the glue/humidity tool
  // (glueRecommendation.service.ts) — when provided, the recommended viscosity/bonding
  // band for that humidity is folded into the prompt so advice isn't generic.
  humidityPct?: number;
  glueUsed?: string;
}

const RETENTION_SYSTEM_PROMPT =
  "You are the LashlyAI Lash Coach, specifically troubleshooting a retention problem. " +
  "Given days since application, the percentage of extensions still remaining, reported " +
  "symptoms (e.g. excess oil, rubbing, poor aftercare, premature shedding), and — when " +
  "available — the humidity at application time, the glue-viscosity band that humidity " +
  "calls for, and which glue the artist actually used, give specific, actionable " +
  "troubleshooting advice. If the glue used doesn't match the recommended band for that " +
  "humidity, call that out explicitly as a likely cause. Be concise and practical.";

export async function troubleshootRetention(
  input: RetentionCheckInput,
): Promise<{ advice: string; mock: boolean }> {
  const contextLines = [
    `Days since application: ${input.daysSinceApplication}.`,
    `Retention remaining: ${input.retentionPct}%.`,
    `Reported symptoms: ${input.symptoms.length ? input.symptoms.join(", ") : "none reported"}.`,
  ];

  if (typeof input.humidityPct === "number") {
    const recommendation = recommendGlue(input.humidityPct);
    contextLines.push(
      `Humidity at application: ${input.humidityPct}% (${recommendation.band} band — ` +
        `recommended ${recommendation.recommended_viscosity}, ` +
        `${recommendation.approx_bonding_time}).`,
    );
  }
  if (input.glueUsed) {
    contextLines.push(`Glue actually used: ${input.glueUsed}.`);
  }

  const prompt = contextLines.join(" ");

  if (!client) {
    return {
      advice:
        "MOCK RESPONSE — no OPENAI_API_KEY configured. In production this would be real " +
        `troubleshooting advice for: ${prompt}`,
      mock: true,
    };
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: RETENTION_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_tokens: 400,
  });

  const advice = completion.choices[0]?.message?.content ?? "";
  return { advice, mock: false };
}

const CAPTION_SYSTEM_PROMPT =
  "You write short, engaging social media captions for a lash artist's business " +
  "account (Instagram/TikTok style). Given a description of the work/post, write one " +
  "caption (2-3 sentences max, friendly and professional) and 5-8 relevant hashtags. " +
  "Respond with the caption on the first line, then a blank line, then the hashtags " +
  "space-separated on one line starting with #.";

export async function generateCaption(
  postDescription: string,
): Promise<{ caption: string; hashtags: string[]; mock: boolean }> {
  if (!client) {
    return {
      caption: `MOCK RESPONSE — no OPENAI_API_KEY configured. Caption for: "${postDescription}"`,
      hashtags: ["#lashartist", "#lashextensions", "#lashlyai"],
      mock: true,
    };
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: CAPTION_SYSTEM_PROMPT },
      { role: "user", content: postDescription },
    ],
    max_tokens: 300,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const [captionPart, hashtagPart] = raw.split(/\n\s*\n/);
  const hashtags = (hashtagPart ?? "").match(/#\w+/g) ?? [];

  return { caption: (captionPart ?? raw).trim(), hashtags, mock: false };
}

/**
 * AI "after look" preview — image *edit* (not pure generation) of the client's own eye
 * photo, so the result plausibly resembles the same client rather than a generic
 * synthetic face. Same client/mock-fallback convention as the rest of this file. Costs
 * a real gpt-image-1 call, gated separately (see planLimits.service.ts
 * checkLashPreviewQuota) since image generation is pricier than the text calls above.
 */
export async function generateLashPreview(
  baseImageBuffer: Buffer,
  lashSetLabel: string,
  lashStyleLabel: string,
): Promise<{ imageBuffer: Buffer; mock: boolean }> {
  if (!client) {
    // No real preview possible without a key — return the original photo back
    // tagged as mock rather than fabricating an image.
    return { imageBuffer: baseImageBuffer, mock: true };
  }

  const prompt =
    `Edit this client's eye photo to show a realistic, photorealistic preview of ` +
    `finished eyelash extensions in the "${lashSetLabel}" lash set with a "${lashStyleLabel}" ` +
    `finished eye look. Keep the client's actual eye shape, skin, lighting, and facial ` +
    `features unchanged — only add the lash extensions matching the requested set and ` +
    `look. No text, watermarks, or unrelated changes to the rest of the photo.`;

  const file = await toFile(baseImageBuffer, "eye.jpg", { type: "image/jpeg" });
  const response = await client.images.edit({
    image: file,
    prompt,
    model: "gpt-image-1",
    size: "1024x1024",
    quality: "high",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI image edit call returned no image data");
  }

  return { imageBuffer: Buffer.from(b64, "base64"), mock: false };
}

const CLIENT_REPLY_SYSTEM_PROMPT =
  "You draft short, warm, professional reply suggestions for a lash artist responding " +
  "to a client message (e.g. booking questions, aftercare questions, rescheduling). " +
  "Write one reply, 1-3 sentences, matching a friendly professional tone. Don't invent " +
  "specific times, prices, or policies you weren't given.";

export async function generateClientReply(
  clientMessage: string,
): Promise<{ reply: string; mock: boolean }> {
  if (!client) {
    return {
      reply: `MOCK RESPONSE — no OPENAI_API_KEY configured. Reply draft for: "${clientMessage}"`,
      mock: true,
    };
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: CLIENT_REPLY_SYSTEM_PROMPT },
      { role: "user", content: clientMessage },
    ],
    max_tokens: 250,
  });

  const reply = completion.choices[0]?.message?.content ?? "";
  return { reply, mock: false };
}
