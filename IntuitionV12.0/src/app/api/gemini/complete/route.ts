import { NextRequest, NextResponse } from "next/server";

type CompleteRequest = {
  code?: string;
  prefix: string;
  suffix: string;
  cursor?: number;
  indent?: string;
  mode?: "blockComplete";
};


const MODEL = "gemini-3-flash-preview";
const MAX_OUTPUT_TOKENS = 1024;

function stripMarkdownFences(text: string) {
  const fenceRegex = /^```[a-zA-Z]*\n([\s\S]*?)\n```$/m;
  const match = text.trim().match(fenceRegex);
  if (match?.[1]) return match[1].trim();
  return text.trim();
}

function normalizeInsertText(text: string) {
  return stripMarkdownFences(text).replace(/\r\n/g, "\n").trimEnd();
}

function coerceResponse(raw: string) {
  const cleaned = stripMarkdownFences(raw);
  const trimmed = cleaned.trim();
  if (trimmed.startsWith("{") && trimmed.includes("\"insertText\"")) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<{ insertText: string }>;
      const insertText = normalizeInsertText(String(parsed.insertText ?? ""));
      return insertText;
    } catch {
      // Fall through to treat response as plain text
    }
  }
  return normalizeInsertText(cleaned);
}

function hasUnbalancedDelimiters(text: string) {
  let parens = 0;
  let brackets = 0;
  let braces = 0;
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (!inDouble && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      continue;
    }

    if (inSingle || inDouble) continue;

    if (ch === "#") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }

    if (ch === "(") parens += 1;
    if (ch === ")") parens -= 1;
    if (ch === "[") brackets += 1;
    if (ch === "]") brackets -= 1;
    if (ch === "{") braces += 1;
    if (ch === "}") braces -= 1;

    if (parens < 0 || brackets < 0 || braces < 0) return true;
  }

  return parens !== 0 || brackets !== 0 || braces !== 0;
}

function hasUnfinishedLine(text: string) {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\s*(def|class)\b/.test(line) && !trimmed.includes(":")) return true;
    if (/[(\[{]$/.test(trimmed)) return true;
  }
  return false;
}

function isSyntacticallyIncomplete(text: string) {
  return hasUnbalancedDelimiters(text) || hasUnfinishedLine(text);
}

function hasForbiddenDefinitions(text: string) {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("def ") || trimmed.startsWith("class ")) {
      return true;
    }
  }
  return false;
}

function hasReturnLine(text: string) {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "return" || trimmed.startsWith("return ")) {
      return true;
    }
  }
  return false;
}

function endsWithTruncatedLine(text: string) {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    return /[:(\[{]$/.test(trimmed);
  }
  return false;
}

function buildPrompt(payload: CompleteRequest) {
  const indent = payload.indent ?? "";
  const cursor = typeof payload.cursor === "number" ? payload.cursor : null;
  const fullCode = payload.code ?? "";
  const withCursor =
    cursor !== null && cursor >= 0 && cursor <= fullCode.length
      ? `${fullCode.slice(0, cursor)}<<<CURSOR>>>${fullCode.slice(cursor)}`
      : fullCode;
  const contextBlock = fullCode
    ? ["FULL CODE (cursor marked):", withCursor]
    : ["PREFIX:", payload.prefix ?? "", "---", "SUFFIX:", payload.suffix ?? ""];
  return [
    "You are a code completion engine.",
    "Return ONLY the code to insert at the cursor (no JSON, no markdown, no code fences).",
    "Return a complete, syntactically valid Python function body that runs.",
    "Must include a final return statement.",
    "No incomplete control blocks (if/for/while/try must be closed).",
    "Ensure (), [], {} are balanced.",
    "Do not return unfinished def/class lines.",
    "End at a logical boundary (return, pass, or a complete statement).",
    "DO NOT output any lines starting with 'def ' or 'class '.",
    "ABSOLUTELY NO nested def or class.",
    "Do not create helper functions.",
    "Only complete inside the current block.",
    "No example usage or tests.",
    "Keep changes local and minimal.",
    "If unsure, return empty insertText with low confidence.",
    `Indent inserted lines using: ${JSON.stringify(indent)}.`,
    "If a cursor marker is present, insert code at that position.",
    "---",
    ...contextBlock,
  ].join("\n");
}

async function fetchCompletion(prompt: string, apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          thinkingConfig: {
            thinkingLevel: "low",
          },
          temperature: 0.2,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
    }
  );

  return response;
}

export async function POST(req: NextRequest) {
  console.log("[gemini/complete] POST start");
  const payload = (await req.json()) as CompleteRequest;
  console.log("[gemini/complete] payload", {
    hasPrefix: Boolean(payload?.prefix),
    hasSuffix: Boolean(payload?.suffix),
    cursor: payload?.cursor,
    indentLength: payload?.indent?.length ?? 0,
    mode: payload?.mode,
  });

  if (payload?.mode && payload.mode !== "blockComplete") {
    return new NextResponse("", { status: 400 });
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  console.log("[gemini/complete] apiKey present", Boolean(apiKey));
  if (!apiKey) {
    const mock = "def add(a, b):\n    return a + b\n";
    return new NextResponse(mock, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const prompt = buildPrompt(payload);

  try {
    const response = await fetchCompletion(prompt, apiKey);

    if (!response.ok) {
      const errorText = await response.text();
      console.log("[gemini/complete] Gemini error", {
        status: response.status,
        body: errorText?.slice(0, 300),
      });
      return new NextResponse("", { status: 200 });
    }

    const data = await response.json();
    console.log("[gemini/complete] Gemini ok", {
      hasCandidates: Boolean(data?.candidates?.length),
    });
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    let result = coerceResponse(String(text));

    if (hasForbiddenDefinitions(result)) {
      const retryPrompt = `${prompt}\n\nYour output contained def/class. Return completion without any def/class lines.`;
      const retryResponse = await fetchCompletion(retryPrompt, apiKey);
      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        const retryText =
          retryData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        result = coerceResponse(String(retryText));
      }

      if (hasForbiddenDefinitions(result)) {
        return new NextResponse("", {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    }

    if (isSyntacticallyIncomplete(result) || !hasReturnLine(result) || endsWithTruncatedLine(result)) {
      const retryPrompt = `${prompt}\n\nFinish the function completely with a final return.`;
      const retryResponse = await fetchCompletion(retryPrompt, apiKey);
      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        const retryText =
          retryData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        result = coerceResponse(String(retryText));
      }

      if (isSyntacticallyIncomplete(result) || !hasReturnLine(result) || endsWithTruncatedLine(result)) {
        return new NextResponse("", {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    }

    return new NextResponse(result, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.log("[gemini/complete] request failed", error);
    return new NextResponse("", { status: 200 });
  }
}
