import { NextRequest, NextResponse } from "next/server";

const MAX_CODE_LENGTH = 50000;
const MAX_TRACEBACK_LENGTH = 10000;
const GOOGLE_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3-flash-preview";

interface CorrectRequest {
  code: string;
  traceback: string;
  cursor?: { line: number; ch: number };
  constraints?: {
    minimalChange?: boolean;
    doNotRefactor?: boolean;
    pyodideOnly?: boolean;
  };
}

interface CorrectResponse {
  kind: "correct";
  confidence: number;
  title: string;
  explanation: string[];
  edits: Array<{
    startLine: number;
    endLine: number;
    insert: string;
  }>;
}

function buildNumberedCode(code: string): string {
  const lines = code.split("\n");
  return lines
    .map((line, idx) => `${String(idx + 1).padStart(4, " ")} | ${line}`)
    .join("\n");
}

function buildPrompt(
  code: string,
  traceback: string,
  constraints: CorrectRequest["constraints"]
): string {
  const numberedCode = buildNumberedCode(code);

  const constraintsList = [];
  if (constraints?.minimalChange) constraintsList.push("- Minimal, surgical fixes only");
  if (constraints?.doNotRefactor) constraintsList.push("- Do NOT refactor or reorganize code");
  if (constraints?.pyodideOnly) constraintsList.push("- Code must run in Pyodide (browser Python)");

  const constraintsText =
    constraintsList.length > 0
      ? `\nConstraints:\n${constraintsList.join("\n")}`
      : "";

  return `You are a Python error fixer for an accessible IDE running on Pyodide. Your task is to analyze the error and suggest a minimal fix.

USER CODE (with line numbers):
\`\`\`
${numberedCode}
\`\`\`

PYTHON ERROR:
\`\`\`
${traceback}
\`\`\`
${constraintsText}

INSTRUCTIONS:
1. Identify the root cause of the error
2. Suggest exactly ONE minimal fix with line-based edits
3. Return ONLY valid JSON (no markdown, no code fences, no explanation outside JSON)

RESPONSE FORMAT (strict JSON):
{
  "kind": "correct",
  "confidence": <number 0-1>,
  "title": "<short error description>",
  "explanation": ["<reason for error>", "<what fix does>"],
  "edits": [
    {
      "startLine": <number>,
      "endLine": <number>,
      "insert": "<new code to insert, preserving indentation>"
    }
  ]
}

IMPORTANT:
- "startLine" and "endLine" refer to lines shown in the numbered code above
- Replace lines startLine through endLine (inclusive) with the "insert" text
- Preserve proper indentation in the "insert" string
- If no fix is possible, return empty edits array
- Return ONLY the JSON object, nothing else`;
}

async function callGeminiApi(prompt: string): Promise<string> {
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY not configured");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      thinkingConfig: {
        thinkingLevel: "high",
      },
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  };

  const response = await fetch(`${url}?key=${GOOGLE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[gemini/correct] API error:", errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text;
}

function sanitizeJsonOutput(text: string): string {
  // Strip markdown code fences if present
  let cleaned = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  cleaned = cleaned.trim();
  return cleaned;
}

export async function POST(req: NextRequest) {
  console.log("[gemini/correct] POST start");

  try {
    const body = (await req.json()) as CorrectRequest;
    const { code, traceback, cursor, constraints } = body;

    // Validate required fields
    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'code' field" },
        { status: 400 }
      );
    }
    if (!traceback || typeof traceback !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'traceback' field" },
        { status: 400 }
      );
    }

    // Clamp sizes
    const clampedCode = code.slice(0, MAX_CODE_LENGTH);
    const clampedTraceback = traceback.slice(0, MAX_TRACEBACK_LENGTH);

    console.log("[gemini/correct] validated payload", {
      codeLength: clampedCode.length,
      tracebackLength: clampedTraceback.length,
      hasCursor: !!cursor,
    });

    // Build prompt
    const prompt = buildPrompt(clampedCode, clampedTraceback, constraints);

    // Call Gemini
    const rawResponse = await callGeminiApi(prompt);
    console.log("[gemini/correct] raw gemini response:", rawResponse.slice(0, 200));

    // Sanitize and parse JSON
    const jsonStr = sanitizeJsonOutput(rawResponse);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("[gemini/correct] JSON parse failed:", e, "input:", jsonStr.slice(0, 200));
      // Return safe fallback
      return NextResponse.json<CorrectResponse>({
        kind: "correct",
        confidence: 0,
        title: "Could not parse AI suggestion",
        explanation: ["The AI response was malformed. Please try again."],
        edits: [],
      });
    }

    // Validate response structure
    if (!parsed || typeof parsed !== "object") {
      console.warn("[gemini/correct] Invalid response structure");
      return NextResponse.json<CorrectResponse>({
        kind: "correct",
        confidence: 0,
        title: "Invalid suggestion format",
        explanation: ["The AI suggestion format was invalid."],
        edits: [],
      });
    }

    const response = parsed as Record<string, unknown>;
    const result: CorrectResponse = {
      kind: "correct",
      confidence: typeof response.confidence === "number" ? response.confidence : 0,
      title: typeof response.title === "string" ? response.title : "AI Suggestion",
      explanation: Array.isArray(response.explanation)
        ? response.explanation.filter((e): e is string => typeof e === "string")
        : [],
      edits: Array.isArray(response.edits)
        ? response.edits.filter(
            (edit): edit is { startLine: number; endLine: number; insert: string } =>
              typeof edit === "object" &&
              edit !== null &&
              typeof (edit as Record<string, unknown>).startLine === "number" &&
              typeof (edit as Record<string, unknown>).endLine === "number" &&
              typeof (edit as Record<string, unknown>).insert === "string"
          )
        : [],
    };

    console.log("[gemini/correct] success", {
      confidence: result.confidence,
      editCount: result.edits.length,
    });

    return NextResponse.json<CorrectResponse>(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[gemini/correct] error:", errorMessage);
    return NextResponse.json(
      { error: `Server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
